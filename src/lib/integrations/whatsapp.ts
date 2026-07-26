import { hasWhatsApp } from "./config";
import { normalizePhone } from "./whatsapp-phonebook";

function graphVersion() {
  return process.env.META_GRAPH_VERSION || "v25.0";
}

type WaSendResult = {
  ok: true;
  mode: "live" | "mock";
  message_id?: string;
  data?: unknown;
  preview?: unknown;
};

/**
 * WhatsApp Cloud API collector transport.
 * Business-initiated opens should use a template; freeform text works inside the 24h window.
 */
export async function sendWhatsAppMessage(input: {
  to: string;
  body: string;
  interactive?: {
    type: "button" | "list";
    buttons?: { id: string; title: string }[];
  };
}): Promise<WaSendResult> {
  if (!hasWhatsApp()) {
    return {
      ok: true,
      mode: "mock",
      message_id: `wamid.mock.${Date.now()}`,
      preview: input,
    };
  }

  const token = process.env.META_WHATSAPP_TOKEN!;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;
  const to = normalizePhone(input.to);

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
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

  return postMessage(phoneId, token, payload);
}

/** First-touch opener — mirrors Meta dashboard (templates deliver reliably). */
export async function sendWhatsAppTemplate(input: {
  to: string;
  name?: string;
  language?: string;
}): Promise<WaSendResult> {
  if (!hasWhatsApp()) {
    return {
      ok: true,
      mode: "mock",
      message_id: `wamid.mock.tpl.${Date.now()}`,
      preview: input,
    };
  }

  const token = process.env.META_WHATSAPP_TOKEN!;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;
  const to = normalizePhone(input.to);
  const name =
    input.name || process.env.META_WHATSAPP_TEMPLATE || "hello_world";
  const language =
    input.language || process.env.META_WHATSAPP_TEMPLATE_LANG || "en_US";

  return postMessage(phoneId, token, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
    },
  });
}

async function postMessage(
  phoneId: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<WaSendResult> {
  const res = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = (await res.json()) as {
    error?: {
      message?: string;
      code?: number;
      error_user_msg?: string;
      error_data?: { details?: string };
    };
    messages?: Array<{ id?: string }>;
  };

  if (!res.ok) {
    const detail =
      data.error?.error_data?.details ||
      data.error?.error_user_msg ||
      data.error?.message ||
      `WhatsApp send failed (${res.status})`;
    throw new Error(detail);
  }

  return {
    ok: true,
    mode: "live",
    message_id: data.messages?.[0]?.id,
    data,
  };
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
