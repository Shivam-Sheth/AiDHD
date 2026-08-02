import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  CONCIERGE_SYSTEM_PROMPT,
  executeAgentTool,
} from "@/lib/agent-tools/registry";
import { hasOpenAI } from "@/lib/integrations/config";
import { findPlacesInOrder } from "@/lib/geo/airports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant" | "tool"; content: string };

/** Price of the most recently shown flight/hotel/ticket/etc. card, sent by the client. */
type LastOffer = { kind?: string; merchant?: string; amount?: number } | null | undefined;

/** create_payment params derived from the last real offer shown — never a guessed amount. */
function paymentParamsFromLastOffer(lastOffer: LastOffer): Record<string, unknown> {
  const category =
    lastOffer?.kind === "flights"
      ? "flight"
      : lastOffer?.kind === "hotels"
        ? "hotel"
        : lastOffer?.kind === "tickets"
          ? "ticket"
          : lastOffer?.kind === "dining"
            ? "dining"
            : lastOffer?.kind === "clubs"
              ? "club"
              : lastOffer?.kind === "movies"
                ? "movie"
                : "trip";
  return {
    merchant: lastOffer?.merchant || "AiDHD trip",
    amount:
      typeof lastOffer?.amount === "number" && lastOffer.amount > 0
        ? lastOffer.amount
        : undefined,
    category,
  };
}

/**
 * Origin/destination for the no-LLM heuristic paths below — ordered by where
 * each city is actually mentioned in the message (not hardcoded), falling
 * back to sensible demo defaults only when nothing was recognized at all.
 */
function flightRouteFromText(text: string): { origin: string; destination: string } {
  const places = findPlacesInOrder(text);
  if (places.length >= 2) {
    return { origin: places[0].city, destination: places[1].city };
  }
  if (places.length === 1) {
    // Only one city mentioned — the word right before it decides its role.
    // "fly to Bali" (destination) is far more common than "flying from
    // Bali" (origin), so destination is the default when there's no "from".
    const before = text.slice(Math.max(0, places[0].index - 8), places[0].index);
    const isOrigin = /\bfrom\s*$/i.test(before);
    return isOrigin
      ? { origin: places[0].city, destination: "Bali" }
      : { origin: "Chicago", destination: places[0].city };
  }
  return { origin: "Chicago", destination: "Bali" };
}

/**
 * Text concierge with OpenAI function-calling — always-on backup / companion
 * to ElevenLabs voice. Same tools as the live agent.
 */
export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; message?: string; last_offer?: LastOffer };
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

  if (!hasOpenAI()) {
    // Minimal heuristic without LLM
    const lower = userMessage.toLowerCase();
    let name = "search_hotels";
    let params: Record<string, unknown> = { city: "Chicago" };
    const wantsToPay = /pay|book|mandate|prava/.test(lower);
    const payableOffer =
      typeof body.last_offer?.amount === "number" && body.last_offer.amount > 0;
    if (wantsToPay && payableOffer) {
      // Checked before the flight/hotel/etc. keyword branches below — a phrase
      // like "book this flight" contains "flight" too, and would otherwise be
      // reinterpreted as a brand-new search instead of paying for the offer
      // already shown.
      name = "create_payment";
      params = paymentParamsFromLastOffer(body.last_offer);
    } else if (/flight|fly|airline/.test(lower)) {
      name = "search_flights";
      params = {
        ...flightRouteFromText(userMessage),
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
      params = paymentParamsFromLastOffer(body.last_offer);
    } else if (/weather|forecast/.test(lower)) {
      name = "get_weather";
      params = {
        city: /chicago/i.test(lower)
          ? "Chicago"
          : /bali/i.test(lower)
            ? "Bali"
            : /miami/i.test(lower)
              ? "Miami"
              : "New York",
        date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      };
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
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const history = (body.messages || [])
      .slice(-12)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    let scratch = `${CONCIERGE_SYSTEM_PROMPT}

Conversation so far:
${history}

User: ${userMessage}

You may call tools by returning ONLY JSON:
{"tool":"search_flights"|"search_hotels"|"search_tickets"|"search_dining"|"search_clubs"|"search_movies"|"lookup_vendor"|"get_weather"|"create_payment","parameters":{...}}
Once a destination city + first travel date are known, call get_weather(city, date) before replying.
Or answer with ONLY JSON:
{"reply":"your spoken answer to the user"}
`;

    for (let i = 0; i < 4; i++) {
      const response = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: scratch }],
      });
      const text = (response.choices[0]?.message?.content || "").trim();
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
          provider: "openai",
        });
      }

      if (parsed.tool) {
        const toolParams = { ...(parsed.parameters || {}) };
        if (parsed.tool === "create_payment") {
          const amt = Number(toolParams.amount);
          // The model has no memory of exact prices — if it didn't carry one
          // over from a prior search result, fall back to the last real offer shown.
          if (!Number.isFinite(amt) || amt <= 0) {
            const fallback = paymentParamsFromLastOffer(body.last_offer);
            if (fallback.amount != null) toolParams.amount = fallback.amount;
            if (!toolParams.merchant) toolParams.merchant = fallback.merchant;
          }
        }
        const result = await executeAgentTool(parsed.tool, toolParams);
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
      provider: "openai",
    });
  } catch (e) {
    // OpenAI quota/errors → still run a best-guess tool so the UI isn't empty
    const lower = userMessage.toLowerCase();
    let name = "search_hotels";
    let params: Record<string, unknown> = {
      city: "Bali",
      check_in: "2026-09-20",
      check_out: "2026-09-25",
    };
    const wantsToPay = /pay|book|mandate|prava/.test(lower);
    const payableOffer =
      typeof body.last_offer?.amount === "number" && body.last_offer.amount > 0;
    if (wantsToPay && payableOffer) {
      // Same ordering fix as the no-OpenAI branch above — "book this flight"
      // must not be reinterpreted as a new search when there's already an
      // offer on screen to charge for.
      name = "create_payment";
      params = paymentParamsFromLastOffer(body.last_offer);
    } else if (/flight|fly|airline/.test(lower)) {
      name = "search_flights";
      params = {
        ...flightRouteFromText(userMessage),
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
      params = paymentParamsFromLastOffer(body.last_offer);
    } else if (/weather|forecast/.test(lower)) {
      name = "get_weather";
      params = {
        city: /bali/i.test(lower) ? "Bali" : "New York",
        date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      };
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
