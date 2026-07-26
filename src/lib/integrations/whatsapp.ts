import { hasWhatsApp } from "./config";

/**
 * WhatsApp Cloud API collector transport.
 * Conversation stays inside a defined business task (budget + prefs for an event)
 * to stay compliant with Meta's post-Oct-2025 open-domain chatbot restrictions.
 */
export async function sendWhatsAppMessage(input: {
  to: string;
  body: string;
  interactive?: {
    type: "button" | "list";
    buttons?: { id: string; title: string }[];
  };
}) {
  if (!hasWhatsApp()) {
    return {
      ok: true,
      mode: "mock" as const,
      message_id: `wamid.mock.${Date.now()}`,
      preview: input,
    };
  }

  const token = process.env.META_WHATSAPP_TOKEN!;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: input.to,
    type: input.interactive ? "interactive" : "text",
  };

  if (input.interactive?.type === "button" && input.interactive.buttons) {
    payload.interactive = {
      type: "button",
      body: { text: input.body },
      action: {
        buttons: input.interactive.buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    };
  } else {
    payload.text = { body: input.body };
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json();
  return { ok: res.ok, mode: "live" as const, data };
}

export function scriptedWhatsAppFlow(eventTitle: string) {
  return [
    {
      from: "bot",
      text: `Hi — I'm collecting your budget & prefs for "${eventTitle}". Not a general chatbot — just this outing.`,
    },
    {
      from: "bot",
      text: "What's your budget cap?",
      buttons: ["Under $80", "$80–$120", "$120–$200", "Type exact"],
    },
    { from: "user", text: "$80–$120" },
    {
      from: "bot",
      text: "Which nights work?",
      buttons: ["Fri Aug 7", "Sat Aug 8", "Either"],
    },
    { from: "user", text: "Fri Aug 7" },
    {
      from: "bot",
      text: "Any vibe prefs? (free text — e.g. standing room ok, hate long dinners)",
    },
    {
      from: "user",
      text: "Standing room fine, want Brooklyn not Midtown, vegetarian-friendly dinner",
    },
    {
      from: "bot",
      text: "Got it — budget $120, Fri Aug 7, Brooklyn + vegetarian. Submitting to AiDHD.",
    },
  ];
}
