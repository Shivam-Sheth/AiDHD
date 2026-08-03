import { NextResponse } from "next/server";
import {
  CONCIERGE_SYSTEM_PROMPT,
  elevenLabsToolDefinitions,
} from "@/lib/agent-tools/registry";
import { hasElevenLabs } from "@/lib/integrations/config";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal workflow — NO hotel receptionist graph.
 * The leftover "new_booking / manage_existing / property inquiry" workflow
 * was crashing mid-call with ElevenLabs error 1002 when users said "book".
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
 * PATCH the ElevenLabs agent: prompt, client tools, and clear hotel workflow.
 * Body optional: { base_url?: string }
 */
export async function POST(req: Request) {
  if (!hasElevenLabs()) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY required" },
      { status: 503 },
    );
  }
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      { error: "ELEVENLABS_AGENT_ID required" },
      { status: 503 },
    );
  }

  let baseUrl = getBaseUrl();
  try {
    const body = (await req.json()) as { base_url?: string };
    if (body.base_url) baseUrl = body.base_url.replace(/\/$/, "");
  } catch {
    /* default */
  }

  const tools = elevenLabsToolDefinitions(baseUrl);
  const payload = {
    name: "AiDHD Concierge",
    tags: ["aidhd", "concierge"],
    workflow: FLAT_WORKFLOW,
    conversation_config: {
      tts: {
        expressive_mode: false,
        suggested_audio_tags: [],
      },
      agent: {
        first_message:
          "Hey — I'm AiDHD Concierge. Ask me to find flights, hotels, dinner, clubs, or movies — I'll put options on your screen, then open Prava when you're ready to pay.",
        language: "en",
        prompt: {
          prompt: CONCIERGE_SYSTEM_PROMPT,
          llm: "gemini-2.5-flash",
          temperature: 0.4,
          tools,
        },
      },
    },
    platform_settings: {
      // Hotel-template guardrails were ending calls on "unauthorized promises"
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
      { error: "Failed to sync agent", status: res.status, data },
      { status: 502 },
    );
  }

  const wf =
    typeof data === "object" && data && "workflow" in data
      ? (data as { workflow?: { nodes?: Record<string, unknown> } }).workflow
      : undefined;

  return NextResponse.json({
    ok: true,
    agent_id: agentId,
    base_url: baseUrl,
    tools: tools.map((t) => t.name),
    workflow_nodes: Object.keys(wf?.nodes || {}),
    message:
      "Agent synced: hotel workflow cleared, client tools + gemini-2.5-flash. Re-open /agent voice.",
  });
}
