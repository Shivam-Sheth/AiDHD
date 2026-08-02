import { getDebugLogHistory, subscribeDebugLog } from "@/lib/checkout/debug-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events feed of the checkout debug log (see debug-log.ts) —
 * backs the live console panel in ConciergeAgent.tsx. Sends buffered history
 * immediately on connect, then streams new entries as they're published.
 * Dev/demo tooling only — no auth, matching the rest of this app's no-auth
 * demo posture.
 */
export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (entry: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
      };
      // A leading comment line forces headers + this first chunk to flush
      // immediately, regardless of whether there's any history yet — without
      // it, an empty buffer means nothing is ever enqueued and the response
      // never leaves the server, so EventSource sits there looking "connected"
      // never fires and the UI shows disconnected indefinitely.
      controller.enqueue(encoder.encode(": connected\n\n"));
      for (const entry of getDebugLogHistory()) send(entry);
      unsubscribe = subscribeDebugLog(send);
      // Keeps the connection alive through idle proxies/timeouts between
      // checkout events.
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 20_000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
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
