import { NextResponse } from "next/server";
import { hasElevenLabs } from "@/lib/integrations/config";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal workflow — NO hotel receptionist graph.
 * Same guard as /api/agent/sync: leftover booking workflows end the call
 * with ElevenLabs error 1002 the moment the agent tries to "book".
 */
const FLAT_WORKFLOW = {
  edges: {},
  nodes: {
    start_node: {
      type: "start" as const,
      position: { x: 0, y: 0 },
      edge_order: [] as string[],
    },
  },
  prevent_subagent_loops: false,
};

/**
 * Base prompt with NO {{placeholders}}. Real booking details are injected
 * per-call via conversation_config_override.agent.prompt.prompt.
 *
 * Leaving {{placeholders}} in the dashboard prompt is what caused the
 * "rings → answer → immediate hangup" (Twilio 31921) when any key was missing.
 */
const BOOKING_BASE_PROMPT = `You are a booking assistant placing a phone call on behalf of a customer. You are speaking to a human.

## Disclosure
You opened by identifying yourself as an AI assistant on a recorded line. If asked again, say plainly that you are an AI. Never claim to be a human or the customer.

## This call
The specific booking details for THIS call are provided in the system prompt override when the call is placed. Follow those details. Do not invent flight numbers, names, amounts, or card details.

## Payment
You do NOT have card details until get_payment_card returns them after human approval. Never invent a card number. Never read a card to voicemail or an IVR.

## Finishing
Get a confirmation number, repeat it back, then call record_confirmation. On failure call record_failure. Never retry a payment.

Be warm, concise and patient. Hold music and transfers are normal; wait them out.`;

/**
 * PATCH the dedicated booking agent so outbound dials can override
 * first_message + system prompt, and so leftover hotel workflows / guardrails
 * cannot kill the call the moment someone answers.
 *
 * Run once after creating ELEVENLABS_BOOKING_AGENT_ID, and again after deploys
 * that change booking tools/prompt behaviour:
 *
 *   curl -X POST https://YOUR_HOST/api/booking/call/sync
 */
export async function POST(req: Request) {
  if (!hasElevenLabs()) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY required" },
      { status: 503 },
    );
  }

  const agentId = process.env.ELEVENLABS_BOOKING_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      {
        error: "ELEVENLABS_BOOKING_AGENT_ID required",
        hint: "Create a dedicated booking agent (separate from the concierge). Do not reuse ELEVENLABS_AGENT_ID — the card tool must not live on an agent that talks to users.",
      },
      { status: 503 },
    );
  }

  let baseUrl = getBaseUrl();
  try {
    const body = (await req.json()) as { base_url?: string };
    if (body.base_url) baseUrl = body.base_url.replace(/\/$/, "");
  } catch {
    /* empty body is fine */
  }

  const payload = {
    name: "AiDHD Booking Caller",
    tags: ["aidhd", "booking", "outbound"],
    workflow: FLAT_WORKFLOW,
    conversation_config: {
      tts: {
        expressive_mode: false,
        suggested_audio_tags: [],
      },
      agent: {
        // Empty first message — every dial overrides it. A dashboard first
        // message with {{placeholders}} is the classic answer→hangup path.
        first_message: "",
        language: "en",
        prompt: {
          prompt: BOOKING_BASE_PROMPT,
          llm: "gemini-2.5-flash",
          temperature: 0.3,
        },
      },
    },
    platform_settings: {
      // Without these toggles, conversation_config_override is silently
      // ignored (API still 200). Callee answers → silence → drop.
      overrides: {
        conversation_config_override: {
          agent: {
            first_message: true,
            language: true,
            prompt: {
              prompt: true,
            },
          },
        },
      },
      guardrails: {
        version: "1",
        focus: { is_enabled: false },
        prompt_injection: { is_enabled: true },
        content: {
          execution_mode: "streaming",
          config: {
            sexual: { is_enabled: false, threshold: "medium" },
            violence: { is_enabled: false, threshold: "medium" },
            harassment: { is_enabled: false, threshold: 0.5 },
            self_harm: { is_enabled: false, threshold: "medium" },
            profanity: { is_enabled: false, threshold: "medium" },
            religion_or_politics: { is_enabled: false, threshold: "medium" },
            medical_and_legal_information: {
              is_enabled: false,
              threshold: "medium",
            },
          },
          // Don't auto-end the call on content flags mid-booking.
          trigger_action: { type: "end_call" },
        },
        moderation: { execution_mode: "streaming", config: {} },
        custom: { config: { configs: [] } },
      },
    },
  };

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
    {
      method: "PATCH",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* raw */
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to sync booking agent", status: res.status, data },
      { status: 502 },
    );
  }

  const overrides =
    typeof data === "object" &&
    data &&
    "platform_settings" in data
      ? (data as {
          platform_settings?: {
            overrides?: {
              conversation_config_override?: {
                agent?: {
                  first_message?: boolean;
                  prompt?: { prompt?: boolean };
                };
              };
            };
          };
        }).platform_settings?.overrides?.conversation_config_override?.agent
      : undefined;

  return NextResponse.json({
    ok: true,
    agent_id: agentId,
    base_url: baseUrl,
    overrides: {
      first_message: overrides?.first_message === true,
      system_prompt: overrides?.prompt?.prompt === true,
    },
    message:
      "Booking agent synced: first_message + system prompt overrides enabled, hotel workflow cleared, placeholder-free base prompt. Re-dial via /api/booking/call/start|orchestrate|reserve.",
  });
}
