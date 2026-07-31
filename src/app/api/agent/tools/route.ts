import { NextResponse } from "next/server";
import { executeAgentTool } from "@/lib/agent-tools/registry";
import { publishUi } from "@/lib/agent-tools/ui-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ElevenLabs webhook tools + client-tool proxy.
 * Always publishes `ui` to the session/conversation bus so /agent can paint cards.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const secret = process.env.AIDHD_AGENT_TOOL_SECRET;
  if (secret) {
    const hdr = req.headers.get("x-aidhd-tool-secret");
    if (hdr !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const toolName = String(
    url.searchParams.get("tool") ||
      body.tool_name ||
      body.tool ||
      body.name ||
      "",
  ).trim();

  const parameters = (
    body.parameters && typeof body.parameters === "object"
      ? (body.parameters as Record<string, unknown>)
      : body
  ) as Record<string, unknown>;

  const conversation_id = String(
    body.conversation_id ||
      parameters.conversation_id ||
      url.searchParams.get("conversation_id") ||
      "",
  ).trim();
  const session = String(
    body.client_session ||
      parameters.client_session ||
      req.headers.get("x-aidhd-session") ||
      url.searchParams.get("session") ||
      "",
  ).trim();

  const {
    tool_name: _tn,
    tool: _t,
    name: _n,
    parameters: _p,
    tool_call_id: _id,
    conversation_id: _c,
    client_session: _s,
    ...rest
  } = parameters;
  const params =
    body.parameters && typeof body.parameters === "object"
      ? (body.parameters as Record<string, unknown>)
      : rest;

  if (!toolName) {
    return NextResponse.json(
      { error: "Missing tool name", result: "Missing tool name" },
      { status: 400 },
    );
  }

  const result = await executeAgentTool(toolName, params);

  if (result.ui) {
    publishUi({
      session: session || null,
      conversation_id: conversation_id || null,
      tool: toolName,
      ui: result.ui,
    });
  }

  return NextResponse.json({
    result: result.summary,
    ok: result.ok,
    data: result.data,
    ui: result.ui,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    tools: [
      "search_flights",
      "search_hotels",
      "search_tickets",
      "search_dining",
      "search_clubs",
      "search_movies",
      "lookup_vendor",
      "get_weather",
      "create_payment",
      "show_results",
    ],
  });
}
