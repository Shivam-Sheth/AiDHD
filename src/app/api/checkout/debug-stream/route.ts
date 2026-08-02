import { getDebugLogHistory, subscribeDebugLog } from "@/lib/checkout/debug-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events feed of the checkout debug log (see debug-log.ts) —
 * backs the live console at /debug. Sends buffered history immediately on
 * connect, then streams new entries as they're published. Dev/demo tooling
 * only — no auth, matching the rest of this app's no-auth demo posture.
 */
export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (entry: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
      };
      for (const entry of getDebugLogHistory()) send(entry);
      unsubscribe = subscribeDebugLog(send);
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
