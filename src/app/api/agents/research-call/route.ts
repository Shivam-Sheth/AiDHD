import { NextResponse } from "next/server";
import {
  completeResearchJob,
  getResearchJob,
  listResearchJobs,
  startBackgroundResearchCall,
} from "@/lib/agents/research-call";

/**
 * Dual-agent research:
 * POST { question, venue_name, venue_phone, reply_to_phone? }
 * → background ElevenAgents outbound (or simulated) call
 * → findings returned to WhatsApp when done
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const job = getResearchJob(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
  }
  return NextResponse.json({ jobs: listResearchJobs().slice(0, 20) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    question?: string;
    venue_name?: string;
    venue_phone?: string;
    venue_type?: string;
    reply_to_phone?: string;
    group_id?: string;
    /** Demo: instantly complete with simulated venue answer */
    simulate?: boolean;
    findings?: string;
    job_id?: string;
  };

  if (body.job_id && body.findings) {
    const job = await completeResearchJob(body.job_id, body.findings);
    return NextResponse.json({ ok: true, job });
  }

  if (!body.question || !body.venue_name || !body.venue_phone) {
    return NextResponse.json(
      {
        error:
          "question, venue_name, venue_phone required — e.g. height limit at go-kart track",
      },
      { status: 400 },
    );
  }

  const job = await startBackgroundResearchCall({
    question: body.question,
    venue_name: body.venue_name,
    venue_phone: body.venue_phone,
    venue_type: body.venue_type,
    reply_to_phone: body.reply_to_phone,
    group_id: body.group_id,
    reply_channel: body.group_id ? "group" : "whatsapp",
  });

  // If keyed outbound is calling async, client polls GET ?id=
  // If simulate flag or no ElevenAgents phone, job may already be done.
  if (body.simulate && job.status !== "done") {
    const done = await completeResearchJob(
      job.id,
      body.findings ||
        `${body.venue_name} answered: ${body.question} — confirmed for the group.`,
    );
    return NextResponse.json({
      ok: true,
      job: done,
      pattern:
        "concierge_agent → research_agent (background call) → reply on WhatsApp",
    });
  }

  return NextResponse.json({
    ok: true,
    job,
    pattern:
      "concierge_agent (on call with you) → research_agent (calls venue) → findings back in chat",
    poll: `/api/agents/research-call?id=${job.id}`,
  });
}
