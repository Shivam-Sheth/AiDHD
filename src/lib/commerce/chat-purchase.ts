/**
 * "Someone drops a product link in the chat and Prava buys it."
 *
 * Shared by every chat surface (web group chat, iMessage/Linq, SMS) — they all
 * route through the group agent, so the buy flow lives here rather than in any
 * one channel.
 *
 * The flow is deliberately two-phase, because Shopify has no server-to-server
 * charge API and Prava will not issue a card without a human passkey:
 *
 *   1. resolve link -> product      (this file, resolveBuyable)
 *   2. approval card in chat        (groups/approvals, kind "purchase")
 *   3. on Approve: Prava session + pay link posted to chat, then we poll for
 *      the one-time card and drive Shopify's hosted checkout  (startPurchase)
 *   4. if the buyer is slow, the attempt is retryable — "@Prava paid" resumes
 *      it against the same session rather than charging twice  (resumePurchase)
 *
 * Nothing here charges anything without step 2 having happened.
 */

import { executeShopifyPurchase } from "@/lib/checkout/shopify-purchase";
import { createPravaSession } from "@/lib/integrations/prava";
import {
  extractUrls,
  parseShopifyProductUrl,
  resolveShopifyProductUrl,
  type ShopifyProductOffer,
} from "@/lib/integrations/shopify";

/** How long we hold the request open waiting for the buyer's passkey. */
const PASSKEY_WAIT_MS = 40_000;

export type PendingPurchase = {
  group_id: string;
  session_id: string;
  variant_id: string;
  title: string;
  amount: number;
  merchant: string;
  email: string;
  buyer_user_id: string;
  pay_url: string | null;
  created_at: number;
};

// One in-flight purchase per group. Memory-only: a purchase that outlives a
// cold start is one the buyer abandoned, and re-approving is both safe and
// cheap, whereas persisting card-adjacent state is neither.
const g = globalThis as unknown as { __aidhdPendingBuys?: Map<string, PendingPurchase> };
function pendingMap(): Map<string, PendingPurchase> {
  if (!g.__aidhdPendingBuys) g.__aidhdPendingBuys = new Map();
  return g.__aidhdPendingBuys;
}

export function getPendingPurchase(groupId: string): PendingPurchase | null {
  return pendingMap().get(groupId) ?? null;
}

/** "buy this", "get me this", "order it" — plus a bare link with a buy verb. */
const BUY_INTENT =
  /\b(buy|order|purchase|check ?out|get (?:me|us|this|that)|grab (?:me|us|this|that)|add to cart|pay for)\b/i;

export function looksLikePurchaseRequest(text: string): boolean {
  const urls = extractUrls(text);
  const hasProductLink = urls.some((u) => parseShopifyProductUrl(u));
  if (hasProductLink && BUY_INTENT.test(text)) return true;
  // A bare product link with no other instruction reads as "look at this" —
  // require an explicit verb so @Prava never buys something unprompted.
  return false;
}

/** First product link in the message that we can actually resolve. */
export async function resolveBuyable(
  text: string,
): Promise<
  | { ok: true; offer: ShopifyProductOffer; source: "shopify" | "fixture" }
  | { ok: false; reason: string }
> {
  const candidates = extractUrls(text).filter((u) => parseShopifyProductUrl(u));
  if (!candidates.length) {
    return { ok: false, reason: "I don't see a product link in that message." };
  }
  let lastReason = "I couldn't read that product link.";
  for (const url of candidates) {
    const resolved = await resolveShopifyProductUrl(url);
    if (resolved.ok) return resolved;
    lastReason = resolved.reason;
  }
  return { ok: false, reason: lastReason };
}

export type PurchaseProgress = {
  /** Posted to the chat before we start waiting on the passkey. */
  pay_message: string;
  outcome: Awaited<ReturnType<typeof executeShopifyPurchase>>;
};

/**
 * Phase 3: money moves. Only ever called from an approved ActionApproval.
 *
 * `postPayLink` is invoked with the Prava Collect URL *before* polling starts,
 * so the buyer can actually see where to approve — otherwise we'd be waiting
 * on a passkey nobody was told about.
 */
export async function startPurchase(input: {
  groupId: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerName?: string;
  variantId: string;
  title: string;
  amount: number;
  merchant: string;
  postPayLink: (message: string) => Promise<void>;
}): Promise<{ ok: boolean; summary: string; retryable?: boolean }> {
  const session = await createPravaSession({
    user_id: input.buyerUserId,
    user_email: input.buyerEmail,
    merchant: input.merchant,
    amount: input.amount,
    currency: "USD",
    category: "product",
  });

  if (session.error || !session.session_id) {
    return {
      ok: false,
      summary: `Couldn't open a Prava checkout: ${session.error || "no session id"}`,
    };
  }

  const payUrl =
    session.iframe_url ||
    `https://sandbox.collect.prava.space?session=${encodeURIComponent(session.session_id)}`;

  pendingMap().set(input.groupId, {
    group_id: input.groupId,
    session_id: session.session_id,
    variant_id: input.variantId,
    title: input.title,
    amount: input.amount,
    merchant: input.merchant,
    email: input.buyerEmail,
    buyer_user_id: input.buyerUserId,
    pay_url: payUrl,
    created_at: Date.now(),
  });

  await input.postPayLink(
    `💳 ${input.title} — $${input.amount.toFixed(2)} at ${input.merchant}.\n${input.buyerName || "Whoever's paying"}, approve with your passkey here:\n${payUrl}\n\nI'll place the order automatically the moment that clears.`,
  );

  return finishPurchase(input.groupId);
}

/** Phase 3b/4: spend the one-time card. Safe to call again after a timeout. */
export async function finishPurchase(
  groupId: string,
  opts: { pollTimeoutMs?: number } = {},
): Promise<{ ok: boolean; summary: string; retryable?: boolean }> {
  const pending = pendingMap().get(groupId);
  if (!pending) {
    return {
      ok: false,
      summary: "There's no purchase waiting — tag me with the product link to start one.",
    };
  }

  const result = await executeShopifyPurchase({
    session_id: pending.session_id,
    merchant: pending.merchant,
    amount: pending.amount,
    variant_id: pending.variant_id,
    email: pending.email,
    poll_timeout_ms: opts.pollTimeoutMs ?? PASSKEY_WAIT_MS,
  });

  if (result.ok) {
    pendingMap().delete(groupId);
    return {
      ok: true,
      summary: `Ordered ${pending.title} — $${pending.amount.toFixed(2)} at ${pending.merchant}. Confirmation ${result.confirmation_id}.`,
    };
  }

  if (result.retryable) {
    // Session stays pending on purpose — the buyer can still finish the
    // passkey, and "@Prava paid" resumes this exact session (no double charge).
    return {
      ok: false,
      retryable: true,
      summary: `Still waiting on the passkey for ${pending.title}. Finish it at ${pending.pay_url} and reply "@Prava paid" — I'll pick it up from there.`,
    };
  }

  pendingMap().delete(groupId);
  return { ok: false, summary: `Order failed: ${result.error}` };
}

/** "@Prava paid" / "done" after a slow passkey. */
export function looksLikePaidConfirmation(text: string): boolean {
  return /^\s*(?:paid|i paid|done|approved|finished|go ahead)\b/i.test(text.trim());
}
