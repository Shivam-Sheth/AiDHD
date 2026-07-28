/** Last Meta WhatsApp webhook hits — helps debug “no reply” on serverless. */

export type WebhookHit = {
  at: string;
  handled: number;
  from?: string;
  text?: string;
  note?: string;
};

const globalForHits = globalThis as unknown as {
  __aidhdWaHits?: WebhookHit[];
};

function hits(): WebhookHit[] {
  if (!globalForHits.__aidhdWaHits) globalForHits.__aidhdWaHits = [];
  return globalForHits.__aidhdWaHits;
}

export function recordWhatsAppWebhookHit(hit: WebhookHit) {
  const list = hits();
  list.unshift(hit);
  if (list.length > 20) list.length = 20;
}

export function listWhatsAppWebhookHits(): WebhookHit[] {
  return [...hits()];
}
