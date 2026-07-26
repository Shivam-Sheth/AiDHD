import { NextResponse } from "next/server";
import { handleWhatsAppInbound } from "@/lib/collector/whatsapp-bot";
import { claimWhatsAppMessage } from "@/lib/integrations/whatsapp-phonebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  — hub challenge verification
 * POST — process inbound + send reply before responding (reliable in next dev)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected =
    process.env.META_WHATSAPP_VERIFY_TOKEN || "aidhd_verify";

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type WaChange = {
  value?: {
    contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
    messages?: Array<{
      id?: string;
      from?: string;
      type?: string;
      text?: { body?: string };
      button?: { text?: string };
      interactive?: {
        button_reply?: { title?: string };
        list_reply?: { title?: string };
      };
    }>;
  };
};

type InboundJob = {
  id: string;
  from: string;
  text: string;
  profileName?: string;
};

function extractJobs(body: {
  entry?: Array<{ changes?: WaChange[] }>;
}): InboundJob[] {
  const jobs: InboundJob[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;
      const nameByWa = new Map(
        (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
      );
      for (const message of value.messages) {
        if (!message.id || !message.from) continue;
        if (!claimWhatsAppMessage(message.id)) continue;
        let text =
          message.text?.body ||
          message.button?.text ||
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          "";
        if (!text && message.type && message.type !== "text") text = "HELP";
        if (!text.trim()) continue;
        jobs.push({
          id: message.id,
          from: message.from,
          text,
          profileName: nameByWa.get(message.from),
        });
      }
    }
  }
  return jobs;
}

async function processJobs(jobs: InboundJob[]) {
  for (const job of jobs) {
    try {
      console.log(
        `[whatsapp inbound] from=${job.from} text=${JSON.stringify(job.text.slice(0, 80))}`,
      );
      await handleWhatsAppInbound({
        from: job.from,
        text: job.text,
        profileName: job.profileName,
      });
      console.log(`[whatsapp inbound] replied ok from=${job.from}`);
    } catch (err) {
      console.error("[whatsapp webhook]", job.id, err);
    }
  }
}

export async function POST(req: Request) {
  let body: {
    object?: string;
    entry?: Array<{ changes?: WaChange[] }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const jobs = extractJobs(body);
  // Must await — fire-and-forget / after() was dropping date/vibe replies in local tunnel.
  if (jobs.length) await processJobs(jobs);

  return NextResponse.json({ ok: true, handled: jobs.length });
}
