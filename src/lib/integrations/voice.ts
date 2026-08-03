import { hasElevenAgentsOutbound, hasElevenLabs, hasTwilio } from "./config";

export interface VoiceConfirmResult {
  ok: boolean;
  mode:
    | "eleven_agents"
    | "elevenlabs+twilio"
    | "elevenlabs"
    | "script"
    | "mock";
  script: string;
  audio_url?: string;
  call_sid?: string;
  conversation_id?: string;
  detail: string;
}

function defaultScript(input: {
  organizer_name: string;
  event_title: string;
  package_label: string;
  total_cost: number;
  categories: string[];
}) {
  return (
    `Hey ${input.organizer_name}, this is AiDHD. ` +
    `Quick confirm on ${input.event_title}. ` +
    `You picked ${input.package_label} for about $${input.total_cost}. ` +
    `I'm booking ${input.categories.join(", ")} on separate Prava mandates. ` +
    `Say yes to confirm, or reply on WhatsApp if you want changes.`
  );
}

/** Jarvis-style confirmation script — Gemini polish when available. */
export async function craftVoiceScript(input: {
  organizer_name: string;
  event_title: string;
  package_label: string;
  total_cost: number;
  categories: string[];
}): Promise<string> {
  const fallback = defaultScript(input);
  try {
    const { completeJson } = await import("./llm");
    const result = await completeJson({
      system:
        'You write a short Jarvis-like voice script for a group booking agent. Return JSON {"script":"..."}. Max 60 words. Warm, precise, no emojis.',
      user: JSON.stringify(input),
    });
    if (!result) return fallback;
    const parsed = JSON.parse(result.text) as { script?: string };
    return parsed.script?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function synthesizeSpeech(script: string): Promise<{
  audio_url?: string;
  mode: "elevenlabs" | "mock";
}> {
  if (!hasElevenLabs()) {
    return { mode: "mock" };
  }

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: script,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
      }),
    },
  );

  if (!res.ok) {
    return { mode: "mock" };
  }

  // For demo: return a data URL so UI can play without object storage.
  const buf = Buffer.from(await res.arrayBuffer());
  const audio_url = `data:audio/mpeg;base64,${buf.toString("base64")}`;
  return { audio_url, mode: "elevenlabs" };
}

export async function placeElevenAgentsOutbound(input: {
  to: string;
  first_message: string;
  agent_id?: string;
  /**
   * Fully-interpolated system prompt for this call. Prefer this over leaving
   * `{{placeholders}}` in the dashboard prompt — an undefined placeholder
   * tears the call down the instant the callee answers (Twilio 31921).
   *
   * Requires the booking agent's Security → Overrides → System prompt toggle
   * (enabled by POST /api/booking/call/sync).
   */
  system_prompt?: string;
  /** Exposed to the agent's tools as {{key}} — e.g. session_id for the card gate. */
  dynamic_variables?: Record<string, string>;
}): Promise<{
  ok: boolean;
  mode: "eleven_agents" | "mock";
  conversation_id?: string;
  call_sid?: string;
  detail: string;
}> {
  const agentId =
    input.agent_id ||
    process.env.ELEVENLABS_AGENT_ID ||
    process.env.ELEVENLABS_HOTEL_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  if (!hasElevenLabs() || !agentId || !phoneNumberId) {
    return {
      ok: false,
      mode: "mock",
      detail:
        "ElevenAgents outbound needs ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID + ELEVENLABS_AGENT_PHONE_NUMBER_ID",
    };
  }

  const to = input.to.startsWith("+") ? input.to : `+${input.to.replace(/\D/g, "")}`;

  // Bake first_message + prompt at dial time. If overrides are disabled on the
  // agent, ElevenLabs returns 200 and silently ignores these — the call then
  // rings, the person answers, the agent never speaks, and the line drops.
  // Sync with POST /api/booking/call/sync to flip the toggles.
  const agentOverride: {
    first_message: string;
    prompt?: { prompt: string };
  } = {
    first_message: input.first_message,
  };
  if (input.system_prompt?.trim()) {
    agentOverride.prompt = { prompt: input.system_prompt };
  }

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
        to_number: to,
        conversation_initiation_client_data: {
          conversation_config_override: {
            agent: agentOverride,
          },
          dynamic_variables: input.dynamic_variables ?? {},
        },
      }),
    },
  );
  const data = (await res.json()) as {
    conversation_id?: string;
    callSid?: string;
    call_sid?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      mode: "mock",
      detail: data.message || `ElevenAgents outbound failed (${res.status})`,
    };
  }
  return {
    ok: true,
    mode: "eleven_agents",
    conversation_id: data.conversation_id,
    call_sid: data.callSid || data.call_sid,
    detail: `ElevenAgents outbound ${data.conversation_id || data.callSid || "started"}`,
  };
}

export async function placeConfirmCall(input: {
  to: string;
  script: string;
  audio_url?: string;
}): Promise<{ call_sid?: string; mode: "twilio" | "mock"; detail: string }> {
  if (!hasTwilio()) {
    return {
      mode: "mock",
      detail:
        "Twilio not keyed — use ElevenAgents outbound IDs instead, or set TWILIO_*.",
    };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const say = input.script.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const twiml = input.audio_url?.startsWith("http")
    ? `<Response><Play>${input.audio_url}</Play></Response>`
    : `<Response><Say voice="Polly.Joanna">${say}</Say></Response>`;

  const body = new URLSearchParams({
    To: input.to,
    From: from,
    Twiml: twiml,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const data = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    return {
      mode: "mock",
      detail: data.message || `Twilio call failed (${res.status})`,
    };
  }
  return {
    call_sid: data.sid,
    mode: "twilio",
    detail: `Outbound confirm call ${data.sid}`,
  };
}

export async function runVoiceConfirmation(input: {
  organizer_name: string;
  organizer_phone?: string;
  event_title: string;
  package_label: string;
  total_cost: number;
  categories: string[];
}): Promise<VoiceConfirmResult> {
  const script = await craftVoiceScript(input);
  const speech = await synthesizeSpeech(script);

  if (input.organizer_phone && hasElevenAgentsOutbound()) {
    const call = await placeElevenAgentsOutbound({
      to: input.organizer_phone,
      first_message: script,
    });
    return {
      ok: call.ok,
      mode: call.ok ? "eleven_agents" : speech.mode === "elevenlabs" ? "elevenlabs" : "script",
      script,
      audio_url: speech.audio_url,
      call_sid: call.call_sid,
      conversation_id: call.conversation_id,
      detail: call.detail,
    };
  }

  if (input.organizer_phone && hasTwilio()) {
    const call = await placeConfirmCall({
      to: input.organizer_phone,
      script,
      audio_url: speech.audio_url,
    });
    return {
      ok: true,
      mode:
        speech.mode === "elevenlabs" && call.mode === "twilio"
          ? "elevenlabs+twilio"
          : speech.mode === "elevenlabs"
            ? "elevenlabs"
            : "script",
      script,
      audio_url: speech.audio_url,
      call_sid: call.call_sid,
      detail: call.detail,
    };
  }

  return {
    ok: true,
    mode: speech.mode === "elevenlabs" ? "elevenlabs" : "script",
    script,
    audio_url: speech.audio_url,
    detail: speech.audio_url
      ? "Voice clip ready — add ElevenAgents phone IDs for live outbound (Twilio optional)"
      : "Script ready (ELEVENLABS_API_KEY for audio; agent+phone IDs for call)",
  };
}
