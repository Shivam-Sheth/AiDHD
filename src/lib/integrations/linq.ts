import { hasLinq } from "./config";

/**
 * Linq iMessage collector + optional dining confirmation fan-out.
 * Same conversation shape as WhatsApp → same Response schema.
 */
export async function sendLinqMessage(input: {
  chat_id: string;
  body: string;
}) {
  if (!hasLinq()) {
    return {
      ok: true,
      mode: "mock" as const,
      message_id: `linq.mock.${Date.now()}`,
      preview: input,
    };
  }

  const res = await fetch("https://api.linqapp.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return { ok: res.ok, mode: "live" as const, data: await res.json() };
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
    {
      from: "bot",
      text: "Vibe? (free text)",
    },
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
  return sendLinqMessage({
    chat_id: input.chat_id,
    body: `✅ AiDHD booked it:\n${input.summary}`,
  });
}
