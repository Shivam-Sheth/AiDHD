import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  CONCIERGE_SYSTEM_PROMPT,
  executeAgentTool,
} from "@/lib/agent-tools/registry";
import { hasGemini } from "@/lib/integrations/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant" | "tool"; content: string };

/**
 * Text concierge with Gemini function-calling — always-on backup / companion
 * to ElevenLabs voice. Same tools as the live agent.
 */
export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userMessage =
    body.message?.trim() ||
    [...(body.messages || [])].reverse().find((m) => m.role === "user")
      ?.content ||
    "";

  if (!userMessage) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const uiCards: unknown[] = [];
  const toolTrace: Array<{ name: string; summary: string }> = [];

  if (!hasGemini()) {
    // Minimal heuristic without LLM
    const lower = userMessage.toLowerCase();
    let name = "search_hotels";
    let params: Record<string, unknown> = { city: "Chicago" };
    if (/flight|fly|airline/.test(lower)) {
      name = "search_flights";
      params = {
        origin: /chicago|ord/i.test(lower) ? "Chicago" : "Chicago",
        destination: /bali|dps/i.test(lower)
          ? "Bali"
          : /new york|nyc|jfk/i.test(lower)
            ? "New York"
            : "New York",
        depart_date: "2026-08-11",
        return_date: "2026-08-15",
      };
    } else if (/dinner|restaurant|eat|food|dining/.test(lower)) {
      name = "search_dining";
      params = {
        city: /chicago/i.test(lower)
          ? "Chicago"
          : /miami/i.test(lower)
            ? "Miami"
            : "New York",
      };
    } else if (/club|nightlife|techno|disco|dance/.test(lower)) {
      name = "search_clubs";
      params = {
        city: /chicago/i.test(lower)
          ? "Chicago"
          : /brooklyn|nyc|new york/i.test(lower)
            ? "New York"
            : "New York",
      };
    } else if (/movie|cinema|film|showtimes?/.test(lower)) {
      name = "search_movies";
      params = {
        city: /chicago/i.test(lower) ? "Chicago" : "New York",
      };
    } else if (/ticket|concert|show/.test(lower)) {
      name = "search_tickets";
      params = { keyword: "concert", city: "Chicago" };
    } else if (/pay|book|mandate|prava/.test(lower)) {
      name = "create_payment";
      params = { merchant: "AiDHD trip", amount: 500, category: "trip" };
    } else if (/hotel|stay|villa|airbnb/.test(lower)) {
      const city =
        lower.match(/\bin\s+([a-z\s]+?)(?:\s+for|\s+ranked|$)/i)?.[1]?.trim() ||
        "Bali";
      params = { city, check_in: "2026-09-20", check_out: "2026-09-25" };
    }
    const result = await executeAgentTool(name, params);
    if (result.ui) uiCards.push(result.ui);
    return NextResponse.json({
      reply: result.summary,
      ui: uiCards,
      tools: [{ name, summary: result.summary }],
      provider: "heuristic",
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const history = (body.messages || [])
      .slice(-12)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    let scratch = `${CONCIERGE_SYSTEM_PROMPT}

Conversation so far:
${history}

User: ${userMessage}

You may call tools by returning ONLY JSON:
{"tool":"search_flights"|"search_hotels"|"search_tickets"|"search_dining"|"search_clubs"|"search_movies"|"lookup_vendor"|"create_payment","parameters":{...}}
Or answer with ONLY JSON:
{"reply":"your spoken answer to the user"}
`;

    for (let i = 0; i < 4; i++) {
      const response = await ai.models.generateContent({
        model,
        contents: scratch,
        config: { responseMimeType: "application/json" },
      });
      const text = (response.text || "").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) break;
      const parsed = JSON.parse(jsonMatch[0]) as {
        tool?: string;
        parameters?: Record<string, unknown>;
        reply?: string;
      };

      if (parsed.reply && !parsed.tool) {
        return NextResponse.json({
          reply: parsed.reply,
          ui: uiCards,
          tools: toolTrace,
          provider: "gemini",
        });
      }

      if (parsed.tool) {
        const result = await executeAgentTool(
          parsed.tool,
          parsed.parameters || {},
        );
        toolTrace.push({ name: parsed.tool, summary: result.summary });
        if (result.ui) uiCards.push(result.ui);
        scratch += `\n\nTool ${parsed.tool} result: ${result.summary}\nData: ${JSON.stringify(result.data).slice(0, 2500)}\nNow reply to the user with JSON {"reply":"..."} or call another tool.`;
        continue;
      }
      break;
    }

    return NextResponse.json({
      reply:
        toolTrace.map((t) => t.summary).join(" ") ||
        "I looked that up — check the cards on the right.",
      ui: uiCards,
      tools: toolTrace,
      provider: "gemini",
    });
  } catch (e) {
    // Gemini quota/errors → still run a best-guess tool so the UI isn't empty
    const lower = userMessage.toLowerCase();
    let name = "search_hotels";
    let params: Record<string, unknown> = {
      city: "Bali",
      check_in: "2026-09-20",
      check_out: "2026-09-25",
    };
    if (/flight|fly|airline/.test(lower)) {
      name = "search_flights";
      params = {
        origin: "Chicago",
        destination: /bali|dps/i.test(lower) ? "Bali" : "New York",
        depart_date: "2026-08-11",
        return_date: "2026-08-15",
      };
    } else if (/dinner|restaurant|dining|eat/.test(lower)) {
      name = "search_dining";
      params = { city: /chicago/i.test(lower) ? "Chicago" : "New York" };
    } else if (/club|nightlife|techno|disco/.test(lower)) {
      name = "search_clubs";
      params = { city: "New York" };
    } else if (/movie|cinema|film/.test(lower)) {
      name = "search_movies";
      params = { city: "New York" };
    } else if (/ticket|concert|show/.test(lower)) {
      name = "search_tickets";
      params = { keyword: "concert", city: "Chicago" };
    } else if (/pay|book|mandate|prava/.test(lower)) {
      name = "create_payment";
      params = { merchant: "AiDHD trip", amount: 500, category: "trip" };
    } else if (/hotel|stay|villa|airbnb/.test(lower)) {
      const city =
        lower.match(/\bin\s+([a-z\s]+?)(?:\s+for|\s+ranked|$)/i)?.[1]?.trim() ||
        "Bali";
      params = { city, check_in: "2026-09-20", check_out: "2026-09-25" };
    }
    const result = await executeAgentTool(name, params);
    if (result.ui) uiCards.push(result.ui);
    return NextResponse.json({
      reply: `${result.summary} (direct lookup — LLM briefly unavailable)`,
      ui: uiCards,
      tools: [{ name, summary: result.summary }],
      provider: "tool-fallback",
      error: e instanceof Error ? e.message : "Chat LLM failed",
    });
  }
}
