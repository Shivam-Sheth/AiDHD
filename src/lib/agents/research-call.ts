import { randomUUID } from "crypto";
import { hasElevenLabs } from "../integrations/config";
import { sendWhatsAppMessage } from "../integrations/whatsapp";
import { normalizePhone } from "../integrations/whatsapp-phonebook";

export type ResearchJobStatus =
  | "queued"
  | "calling"
  | "answered"
  | "done"
  | "failed";

/**
 * What kind of business the agent is calling — drives the phone script.
 * Covers restaurants, hotels, airlines, venues, ticket providers, stores,
 * support desks, and any other merchant.
 */
export type CallVenueType =
  | "restaurant"
  | "hotel"
  | "airline"
  | "event_venue"
  | "ticket_provider"
  | "store"
  | "customer_support"
  | "merchant"
  | "other";

export interface ResearchJob {
  id: string;
  question: string;
  venue_name: string;
  venue_phone: string;
  venue_type?: CallVenueType | string;
  reply_to_phone?: string;
  reply_channel: "whatsapp" | "web" | "group";
  /** When set, findings are posted back into this group chat. */
  group_id?: string;
  status: ResearchJobStatus;
  conversation_id?: string;
  call_sid?: string;
  findings?: string;
  created_at: string;
  updated_at: string;
}

interface ResearchStore {
  jobs: Map<string, ResearchJob>;
}

const g = globalThis as unknown as { __aidhdResearch?: ResearchStore };

function store(): ResearchStore {
  if (!g.__aidhdResearch) g.__aidhdResearch = { jobs: new Map() };
  return g.__aidhdResearch;
}

export function getResearchJob(id: string) {
  return store().jobs.get(id);
}

export function listResearchJobs() {
  return [...store().jobs.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

function upsert(job: ResearchJob) {
  store().jobs.set(job.id, job);
  return job;
}

/**
 * Dual-agent pattern:
 * - User talks to the concierge agent (ElevenAgents chat/call)
 * - Concierge triggers THIS research agent to place a background outbound call
 * - Findings fan back to WhatsApp / web
 *
 * Hotel template → set ELEVENLABS_HOTEL_AGENT_ID
 * Research/venue Q&A → set ELEVENLABS_RESEARCH_AGENT_ID (or reuse hotel agent)
 */
export async function startBackgroundResearchCall(input: {
  question: string;
  venue_name: string;
  venue_phone: string;
  venue_type?: CallVenueType | string;
  reply_to_phone?: string;
  reply_channel?: "whatsapp" | "web" | "group";
  group_id?: string;
}): Promise<ResearchJob> {
  const job: ResearchJob = {
    id: randomUUID(),
    question: input.question.trim(),
    venue_name: input.venue_name.trim(),
    venue_phone: normalizePhone(input.venue_phone),
    venue_type: input.venue_type,
    reply_to_phone: input.reply_to_phone
      ? normalizePhone(input.reply_to_phone)
      : undefined,
    reply_channel: input.reply_channel ?? "whatsapp",
    group_id: input.group_id,
    status: "queued",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  upsert(job);

  const agentId =
    process.env.ELEVENLABS_RESEARCH_AGENT_ID ||
    process.env.ELEVENLABS_HOTEL_AGENT_ID ||
    process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  if (!hasElevenLabs() || !agentId || !phoneNumberId) {
    // Demo path: simulate a successful background research call
    job.status = "calling";
    job.updated_at = new Date().toISOString();
    upsert(job);

    const findings = await simulateVenueAnswer(job);
    return completeResearchJob(job.id, findings);
  }

  const venueLabel = venueTypeLabel(job.venue_type);
  const firstMessage =
    `Hi, I'm calling from Prava on behalf of a customer. ` +
    `Quick question for ${venueLabel} ${job.venue_name}: ${job.question} ` +
    `Please answer briefly so I can relay it. ` +
    `I can ask about availability, prices, reservations, policies, ` +
    `accessibility, dietary requirements, cancellations, refunds, or order ` +
    `status — I am not authorized to commit to any booking, cancellation, ` +
    `account change, or payment on this call.`;

  try {
    const res = await fetch(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: phoneNumberId,
          to_number: `+${job.venue_phone}`,
          conversation_initiation_client_data: {
            conversation_config_override: {
              agent: {
                first_message: firstMessage,
              },
            },
            dynamic_variables: {
              venue_name: job.venue_name,
              research_question: job.question,
              job_id: job.id,
            },
          },
        }),
      },
    );
    const data = (await res.json()) as {
      conversation_id?: string;
      callSid?: string;
      call_sid?: string;
      message?: string;
      detail?: string;
    };

    if (!res.ok) {
      job.status = "failed";
      job.findings =
        data.message || data.detail || `Outbound failed (${res.status})`;
      job.updated_at = new Date().toISOString();
      return upsert(job);
    }

    job.status = "calling";
    job.conversation_id = data.conversation_id;
    job.call_sid = data.callSid || data.call_sid;
    job.updated_at = new Date().toISOString();
    return upsert(job);
  } catch (err) {
    job.status = "failed";
    job.findings = err instanceof Error ? err.message : "Outbound error";
    job.updated_at = new Date().toISOString();
    return upsert(job);
  }
}

function venueTypeLabel(type?: string): string {
  switch (type) {
    case "restaurant":
      return "the restaurant";
    case "hotel":
      return "the hotel";
    case "airline":
      return "the airline";
    case "event_venue":
      return "the venue";
    case "ticket_provider":
      return "the ticket provider";
    case "store":
      return "the store";
    case "customer_support":
      return "the support team at";
    default:
      return "the business";
  }
}

async function simulateVenueAnswer(job: ResearchJob): Promise<string> {
  const q = job.question.toLowerCase();
  if (q.includes("height") || q.includes("tall") || q.includes("kart")) {
    return `${job.venue_name} said drivers must be at least 54 inches (137 cm). Kids under that can ride as passengers if an adult drives.`;
  }
  if (q.includes("cancel") || q.includes("refund")) {
    return `${job.venue_name}: free cancel until 24h before; after that it's a credit only.`;
  }
  if (q.includes("check-in") || q.includes("check in")) {
    return `${job.venue_name}: check-in from 3pm, early bags ok at the front desk.`;
  }
  try {
    const { completeJson } = await import("../integrations/llm");
    const result = await completeJson({
      system:
        'You simulate a short venue-staff answer after a research phone call. Return JSON {"findings":"..."}. One or two sentences.',
      user: JSON.stringify({
        venue: job.venue_name,
        question: job.question,
      }),
    });
    if (result) {
      const parsed = JSON.parse(result.text) as { findings?: string };
      if (parsed.findings) return parsed.findings;
    }
  } catch {
    // fall through
  }
  return `${job.venue_name} confirmed they can help with: "${job.question}". Full details available at the front desk.`;
}

export async function completeResearchJob(id: string, findings: string) {
  const job = store().jobs.get(id);
  if (!job) throw new Error("Research job not found");
  job.status = "done";
  job.findings = findings;
  job.updated_at = new Date().toISOString();
  upsert(job);

  if (job.reply_to_phone && job.reply_channel === "whatsapp") {
    await sendWhatsAppMessage({
      to: job.reply_to_phone,
      body: `Research agent called ${job.venue_name}:\nQ: ${job.question}\nA: ${findings}`,
    });
  }

  // Fan findings back into the group chat that asked for the call.
  if (job.group_id) {
    try {
      const { appendMessage } = await import("@/lib/groups/store");
      const { AIDHD_BOT_ID, AIDHD_BOT_NAME } = await import(
        "@/lib/groups/types"
      );
      await appendMessage({
        groupId: job.group_id,
        senderId: AIDHD_BOT_ID,
        senderName: AIDHD_BOT_NAME,
        body: `📞 Called ${job.venue_name}:\nQ: ${job.question}\nA: ${findings}`,
        kind: "tool_result",
        meta: { call_job_id: job.id },
      });
    } catch {
      // non-fatal
    }
  }
  return job;
}

/**
 * Generate a user-led call script — the user dials themselves; we hand them
 * a ready-to-read script with all the relevant details.
 */
export async function generateCallScript(input: {
  venue_name: string;
  venue_type?: CallVenueType | string;
  purpose: string;
  details?: Record<string, unknown>;
  caller_name?: string;
}): Promise<{ script: string; tips: string[] }> {
  const detailLines = Object.entries(input.details || {})
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${String(v)}`)
    .join("\n");

  try {
    const { completeJson } = await import("../integrations/llm");
    const result = await completeJson({
      system:
        `You write short phone-call scripts a customer reads when calling a business ` +
        `(${venueTypeLabel(input.venue_type)}). Return JSON ` +
        `{"script":"...","tips":["...","..."]}. The script should be natural ` +
        `first-person sentences covering: who they are, what they need, the key ` +
        `details, and the questions to ask. Under 120 words. 2-3 short tips.`,
      user: JSON.stringify({
        venue: input.venue_name,
        venue_type: input.venue_type || "other",
        purpose: input.purpose,
        caller_name: input.caller_name || "the customer",
        details: input.details || {},
      }),
    });
    if (result) {
      const parsed = JSON.parse(result.text) as {
        script?: string;
        tips?: string[];
      };
      if (parsed.script) {
        return { script: parsed.script, tips: parsed.tips || [] };
      }
    }
  } catch {
    // fall through to template
  }

  const script =
    `Hi, my name is ${input.caller_name || "…"} — I'm calling about ${input.purpose}.` +
    (detailLines ? `\n\nDetails to mention:\n${detailLines}` : "") +
    `\n\nQuestions to ask:\n- Is that available?\n- What's the total price?\n- What's the cancellation policy?\n- Can I get a confirmation number?`;
  return {
    script,
    tips: [
      "Ask for a confirmation number before hanging up.",
      "Confirm the total price including fees.",
    ],
  };
}
