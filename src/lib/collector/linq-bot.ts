/**
 * Inbound Linq (iMessage) collector — slot-fill prefs → search → Prava.
 * Sessions persist via AIDHD_STATE_BLOB so serverless cold starts don't loop.
 */

import { executeAgentTool } from "../agent-tools/registry";
import { displayCityForPlace, lookupPlace } from "../geo/airports";
import { isOptOut, sendLinqChatMessage } from "../integrations/linq";
import {
  claimLinqEvent,
  clearLinqSession,
  getLinqSession,
  saveLinqSession,
  type LinqSession,
} from "./linq-sessions";

type LinqInbound = {
  chat_id: string;
  from_phone: string;
  text: string;
  event_id?: string;
};

async function reply(chatId: string, text: string, bag: string[]) {
  bag.push(text);
  const sent = await sendLinqChatMessage({ chat_id: chatId, text });
  if (!sent.ok) {
    console.error("[linq-bot] send failed", sent.status, sent.data);
  }
}

/** Tool summaries are written for the voice agent — tone them down for iMessage. */
function humanizeToolLine(summary: string): string {
  return summary
    .replace(/\s*Cards are on (the user's screen|screen)[^.]*\.?/gi, "")
    .replace(/\s*— summarize briefly\.?/gi, "")
    .replace(/\s*Ask them to approve[^.]*\.?/gi, "")
    .replace(/\s*do not read URLs aloud\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseBudget(text: string): number | null {
  const cleaned = text.toLowerCase().replace(/,/g, "");
  const dollar = cleaned.match(
    /(?:\$\s*|usd\s*)(\d{2,4})|(\d{2,4})\s*(?:dollars?|bucks|usd|pp|\/pp|per person)\b/,
  );
  if (dollar) return Number(dollar[1] || dollar[2]);
  // Bare number only when the whole message is essentially a budget
  const bare = cleaned.trim().match(/^\$?\s*(\d{2,4})\s*$/);
  if (bare) return Number(bare[1]);
  return null;
}

function parseRoute(text: string): {
  origin?: string;
  destination?: string;
  city?: string;
} {
  const lower = text.toLowerCase();
  const fromTo =
    lower.match(
      /\bfrom\s+([a-z .]+?)\s+(?:to|→|->)\s+([a-z .]+?)(?:\s|$|,|\.|!|\?)/i,
    ) ||
    lower.match(
      /\b(chicago|nyc|new york|miami|boston|atlanta|dallas|seattle|austin|denver|la|los angeles|sf|san francisco)\s+(?:to|→|->)\s+(chicago|nyc|new york|miami|boston|atlanta|dallas|seattle|austin|denver|la|los angeles|sf|san francisco)\b/i,
    );
  if (fromTo) {
    const o = lookupPlace(fromTo[1].trim());
    const d = lookupPlace(fromTo[2].trim());
    if (o || d) {
      return {
        origin: o?.city || displayCityForPlace(fromTo[1].trim()),
        destination: d?.city || displayCityForPlace(fromTo[2].trim()),
      };
    }
  }
  const cities: string[] = [];
  for (const name of [
    "new york",
    "nyc",
    "miami",
    "chicago",
    "los angeles",
    "la",
    "boston",
    "atlanta",
    "dallas",
    "seattle",
    "austin",
    "denver",
    "san francisco",
    "sf",
    "london",
    "paris",
    "bali",
  ]) {
    if (lower.includes(name)) {
      const city = lookupPlace(name)?.city;
      if (city && !cities.includes(city)) cities.push(city);
    }
  }
  if (cities.length >= 2) {
    return { origin: cities[0], destination: cities[1] };
  }
  if (cities.length === 1) return { city: cities[0] };
  return {};
}

function parseDates(text: string): string | null {
  const t = text.trim();
  if (/^(flex(ible)?|anytime|whenever|tba|tbd)$/i.test(t)) return "flexible";
  if (/\bflex/i.test(t) && t.length < 40) return "flexible";
  if (
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(t) ||
    /\b\d{1,2}\s*[-–/]\s*\d{1,2}\b/.test(t) ||
    /\b(this|next)\s+(weekend|week|month)\b/i.test(t) ||
    /\bweekend\b/i.test(t)
  ) {
    return t;
  }
  return null;
}

function mergeSlots(sess: LinqSession, text: string): LinqSession {
  const next = { ...sess };
  const budget = parseBudget(text);
  if (budget != null) next.budget = budget;

  const route = parseRoute(text);
  if (route.origin) next.origin = route.origin;
  if (route.destination) next.destination = route.destination;
  if (route.city) next.city = route.city;

  const dates = parseDates(text);
  if (dates) next.dates = dates;

  // Keep a human vibe line when they wrote more than a bare number
  if (!parseBudget(text) || text.trim().length > 6) {
    const looksLikeDatesOnly =
      dates && text.trim().length < 48 && !route.origin && !route.city;
    const looksLikeBudgetOnly = budget != null && /^\$?\s*\d{2,4}\s*$/.test(text.trim());
    if (!looksLikeDatesOnly && !looksLikeBudgetOnly) {
      next.vibe = text.trim();
    }
  }

  return next;
}

function wantsFlight(sess: LinqSession): boolean {
  const blob = `${sess.vibe || ""} ${sess.origin || ""} ${sess.destination || ""}`.toLowerCase();
  return Boolean(
    sess.origin &&
      sess.destination &&
      sess.origin !== sess.destination,
  ) || /flight|fly|trip|airport|weekend away/.test(blob);
}

function missingPrompt(sess: LinqSession): string | null {
  const hasPlace =
    Boolean(sess.city) ||
    Boolean(sess.origin && sess.destination) ||
    Boolean(sess.vibe && parseRoute(sess.vibe || "").city);

  if (!hasPlace && !sess.vibe) {
    return "yo — what's the plan? city night out, or a trip (like chicago → nyc)?";
  }
  if (!hasPlace) {
    return "nice. which city — or are we flying somewhere (from → to)?";
  }
  if (sess.budget == null) {
    const where =
      sess.origin && sess.destination
        ? `${sess.origin} → ${sess.destination}`
        : sess.city || "that";
    return `cool, ${where}. what's your budget per person? just a number is fine`;
  }
  if (!sess.dates) {
    return "got it. dates? (aug 11-15 works, or just say flexible)";
  }
  return null;
}

function departReturn(dates?: string): { depart: string; ret: string } {
  // Default near-term demo window for hackathon
  const depart = "2026-08-11";
  const ret = "2026-08-15";
  if (!dates || /flex/i.test(dates)) return { depart, ret };
  return { depart, ret };
}

export async function handleLinqInbound(msg: LinqInbound): Promise<{
  replies: string[];
  opted_out?: boolean;
  skipped?: string;
}> {
  const key = msg.from_phone || msg.chat_id;
  const replies: string[] = [];

  if (msg.event_id) {
    const fresh = await claimLinqEvent(msg.event_id);
    if (!fresh) return { replies: [], skipped: "duplicate_event" };
  }

  if (isOptOut(msg.text)) {
    const sess = await getLinqSession(key);
    await saveLinqSession(key, { ...sess, opted_out: true, phase: "done" });
    await reply(
      msg.chat_id,
      "all good — i'll stop texting. send START anytime if you want back in",
      replies,
    );
    return { replies, opted_out: true };
  }

  let sess = await getLinqSession(key);

  if (sess.opted_out) {
    if (/^(START|OPTIN|UNSTOP)$/i.test(msg.text.trim())) {
      await clearLinqSession(key);
      sess = { phase: "chat" };
    } else {
      return { replies: [], opted_out: true };
    }
  }

  if (/^(reset|restart|new|start over)$/i.test(msg.text.trim())) {
    await clearLinqSession(key);
    sess = { phase: "chat" };
    await reply(
      msg.chat_id,
      "fresh start. what are we planning?",
      replies,
    );
    await saveLinqSession(key, sess);
    return { replies };
  }

  if (/^paid$/i.test(msg.text.trim()) && sess.last_session_id) {
    const { completePravaCheckout } = await import("../integrations/prava");
    const result = await completePravaCheckout({
      session_id: sess.last_session_id,
      merchant: sess.last_merchant || "AiDHD",
      amount: sess.last_amount || 100,
      category: "trip",
    });
    await reply(
      msg.chat_id,
      `you're set — ${result.confirmation_id}. mandate ${result.mandate.mandate_id}. have fun`,
      replies,
    );
    sess.phase = "done";
    await saveLinqSession(key, sess);
    return { replies };
  }

  if (sess.phase === "awaiting_pay") {
    const peek = parseRoute(msg.text);
    const replanning =
      Boolean(peek.origin || peek.city) ||
      /dinner|flight|trip|hotel|club|movie/i.test(msg.text);
    if (!replanning) {
      await reply(
        msg.chat_id,
        "still waiting on Collect — text PAID when you're through the passkey, or RESET to redo the plan",
        replies,
      );
      return { replies };
    }
    sess = {
      phase: "chat",
      vibe: undefined,
      origin: undefined,
      destination: undefined,
      city: undefined,
      budget: sess.budget,
      dates: sess.dates,
    };
  }

  if (sess.phase === "done") {
    sess = { phase: "chat", budget: sess.budget };
  }

  // Merge whatever they just said into slots
  sess = mergeSlots(sess, msg.text);
  sess.phase = "chat";

  const ask = missingPrompt(sess);
  if (ask) {
    await saveLinqSession(key, sess);
    await reply(msg.chat_id, ask, replies);
    return { replies };
  }

  // Have vibe/place + budget + dates → search
  const vibe = (sess.vibe || "").toLowerCase();
  const flight = wantsFlight(sess);

  if (flight) {
    const origin = sess.origin || "Chicago";
    const destination = sess.destination || sess.city || "New York";
    const { depart, ret } = departReturn(sess.dates);
    await reply(
      msg.chat_id,
      `on it — ${origin} → ${destination}, ~$${sess.budget}/pp, ${sess.dates}. one sec`,
      replies,
    );

    const fl = await executeAgentTool("search_flights", {
      origin,
      destination,
      depart_date: depart,
      return_date: ret,
    });
    await reply(msg.chat_id, humanizeToolLine(fl.summary), replies);

    const amount = sess.budget || 200;
    const pay = await executeAgentTool("create_payment", {
      merchant: `AiDHD ${origin}→${destination}`,
      amount,
      category: "flight",
      email: "ameyagarwal10@gmail.com",
    });
    const data = pay.data as
      | { session_id?: string; iframe_url?: string }
      | undefined;
    if (data?.session_id) {
      sess.last_session_id = data.session_id;
      sess.last_merchant = `AiDHD ${origin}→${destination}`;
      sess.last_amount = amount;
      sess.phase = "awaiting_pay";
    }
    const link =
      data?.iframe_url ||
      (data?.session_id
        ? `https://sandbox.collect.prava.space?session=${data.session_id}`
        : "https://aidhd-onkaaqeb6-amey-agarwals-projects.vercel.app/agent");
    await reply(
      msg.chat_id,
      `if that works, approve $${amount} here (Prava Collect):\n${link}\n\ntext PAID after the passkey and i'll lock it`,
      replies,
    );
  } else {
    const city = sess.city || sess.destination || "New York";
    await reply(
      msg.chat_id,
      `bet — ${city}, ~$${sess.budget}/pp, ${sess.dates}. digging up dinner spots`,
      replies,
    );

    const din = await executeAgentTool("search_dining", { city });
    await reply(msg.chat_id, humanizeToolLine(din.summary), replies);

    const trust = await executeAgentTool("lookup_vendor", {
      vendor: /chicago/i.test(city) ? "Alinea" : "Lilia",
    });
    await reply(
      msg.chat_id,
      `quick trust check — ${humanizeToolLine(trust.summary)}`,
      replies,
    );

    const amount = Math.min(sess.budget || 80, 95);
    const pay = await executeAgentTool("create_payment", {
      merchant: `AiDHD dinner · ${city}`,
      amount,
      category: "dining",
    });
    const data = pay.data as
      | { session_id?: string; iframe_url?: string }
      | undefined;
    if (data?.session_id) {
      sess.last_session_id = data.session_id;
      sess.last_merchant = `AiDHD dinner · ${city}`;
      sess.last_amount = amount;
      sess.phase = "awaiting_pay";
    }
    const link =
      data?.iframe_url ||
      (data?.session_id
        ? `https://sandbox.collect.prava.space?session=${data.session_id}`
        : "https://aidhd-onkaaqeb6-amey-agarwals-projects.vercel.app/agent");
    await reply(
      msg.chat_id,
      `wanna hold a table for $${amount}? pay here:\n${link}\n\nthen just text PAID`,
      replies,
    );
  }

  // Soft voice handoff once — no spam
  if (!/voice|call|agent/i.test(vibe)) {
    await reply(
      msg.chat_id,
      `want to talk it through live instead? https://aidhd-onkaaqeb6-amey-agarwals-projects.vercel.app/agent`,
      replies,
    );
  }

  await saveLinqSession(key, sess);
  return { replies };
}
