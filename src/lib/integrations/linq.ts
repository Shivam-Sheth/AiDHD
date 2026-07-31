/**
 * Linq Partner API v3 — iMessage / RCS / SMS.
 * Docs: https://docs.linqapp.com/getting-started/quickstart/
 *
 * Sandbox rules:
 * - Inbound-first: user texts before we can open a chat productively
 * - First outbound in a new chat: no links, reply_to, or effects
 * - Opt-out keywords must stop outbound (Linq does not auto-suppress)
 */

import { hasLinq } from "./config";

const BASE = "https://api.linqapp.com/api/partner/v3";

function linqNumber(): string {
  return (process.env.LINQ_PHONE_NUMBER || "").trim();
}

async function linqFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.LINQ_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* raw */
  }
  return { ok: res.ok, status: res.status, data };
}

/** True if text contains a URL — banned on first outbound create-chat. */
export function containsLink(text: string): boolean {
  return /https?:\/\/|www\.|\.com\/|\.app\b/i.test(text);
}

const OPT_OUT = /^(STOP|UNSUBSCRIBE|OPTOUT|CANCEL|END|QUIT)$/i;

export function isOptOut(text: string): boolean {
  return OPT_OUT.test(text.trim());
}

/**
 * Create chat + first message. Must be link-free.
 */
export async function createLinqChat(input: {
  to: string[];
  text: string;
  from?: string;
}) {
  if (containsLink(input.text)) {
    return {
      ok: false as const,
      mode: "live" as const,
      error: "First outbound message cannot contain links",
    };
  }

  if (!hasLinq()) {
    return {
      ok: true as const,
      mode: "mock" as const,
      chat_id: `linq_mock_${Date.now()}`,
      preview: input,
    };
  }

  const from = input.from || linqNumber();
  if (!from) {
    return {
      ok: false as const,
      mode: "live" as const,
      error: "LINQ_PHONE_NUMBER missing",
    };
  }

  const { ok, status, data } = await linqFetch("/chats", {
    method: "POST",
    body: JSON.stringify({
      from,
      to: input.to,
      message: { parts: [{ type: "text", value: input.text }] },
    }),
  });

  // CreateChatResult nests id under `chat.id`
  const chatId = extractChatId(data);

  return { ok, mode: "live" as const, status, chat_id: chatId, data };
}

function extractChatId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  const chat = obj.chat as Record<string, unknown> | undefined;
  if (chat && typeof chat.id === "string") return chat.id;
  return undefined;
}

/** Follow-up in an existing chat — links OK here. */
export async function sendLinqChatMessage(input: {
  chat_id: string;
  text: string;
}) {
  if (!hasLinq()) {
    return {
      ok: true as const,
      mode: "mock" as const,
      message_id: `linq.mock.${Date.now()}`,
      preview: input,
    };
  }

  // SendMessageToChatRequest requires `{ message: { parts: [...] } }`
  const { ok, status, data } = await linqFetch(
    `/chats/${encodeURIComponent(input.chat_id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        message: { parts: [{ type: "text", value: input.text }] },
      }),
    },
  );

  return { ok, mode: "live" as const, status, data };
}

/** @deprecated use sendLinqChatMessage — kept for older call sites */
export async function sendLinqMessage(input: {
  chat_id: string;
  body: string;
}) {
  return sendLinqChatMessage({ chat_id: input.chat_id, text: input.body });
}

export async function subscribeLinqWebhook(input: {
  target_url: string;
  events?: string[];
}) {
  if (!hasLinq()) {
    return { ok: true as const, mode: "mock" as const, preview: input };
  }

  const { ok, status, data } = await linqFetch("/webhook-subscriptions", {
    method: "POST",
    body: JSON.stringify({
      target_url: input.target_url,
      subscribed_events: input.events || [
        "message.sent",
        "message.received",
        "message.delivered",
        "message.read",
        "message.failed",
      ],
    }),
  });

  return { ok, mode: "live" as const, status, data };
}

export function scriptedLinqFlow(eventTitle: string) {
  return [
    {
      from: "bot",
      text: `Hey — quick prefs check for "${eventTitle}" via iMessage.`,
    },
    { from: "bot", text: "Budget cap? Reply with a number or range." },
    { from: "user", text: "200" },
    { from: "bot", text: "Fri Aug 7 or Sat Aug 8?" },
    { from: "user", text: "Either, prefer Sat if seats are better" },
    { from: "bot", text: "Vibe? (free text)" },
    {
      from: "user",
      text: "Want a proper sit-down dinner and good seats — fine splurging a bit",
    },
    {
      from: "bot",
      text: "Locked: $200, flexible dates, sit-down + better seats. Sending to AiDHD.",
    },
  ];
}

export async function sendBookingConfirmationToGroup(input: {
  chat_id: string;
  summary: string;
}) {
  // Confirmation may include links — only use after chat exists
  return sendLinqChatMessage({
    chat_id: input.chat_id,
    text: `AiDHD booked it:\n${input.summary}`,
  });
}

/** Build a Google Flights deep link (UI helper — not an API). */
export function googleFlightsUrl(input: {
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string;
}) {
  const o = encodeURIComponent(input.origin);
  const d = encodeURIComponent(input.destination);
  if (input.return_date) {
    return `https://www.google.com/travel/flights?q=Flights%20to%20${d}%20from%20${o}%20on%20${encodeURIComponent(input.depart_date)}%20through%20${encodeURIComponent(input.return_date)}`;
  }
  return `https://www.google.com/travel/flights?q=Flights%20to%20${d}%20from%20${o}%20on%20${encodeURIComponent(input.depart_date)}`;
}
