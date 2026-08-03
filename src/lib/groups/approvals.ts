/**
 * Approval-gated agent actions.
 *
 * @Prava never executes an external, financial, or legally meaningful action
 * on its own: it files an ActionApproval (pending) and posts an
 * approval_request message. A human taps Approve / Decline; on approval the
 * stored payload is executed and the outcome lands back in the chat.
 */

import { randomUUID } from "crypto";
import { broadcastGroupEvent } from "@/lib/realtime/broadcast";
import { appendMessage, sb, supabaseConfigured } from "./store";
import {
  AIDHD_BOT_ID,
  AIDHD_BOT_NAME,
  type ActionApproval,
  type ApprovalKind,
  type ApprovalStatus,
} from "./types";

type ApprovalsMemory = { approvals: Map<string, ActionApproval> };

const g = globalThis as unknown as { __aidhdApprovals?: ApprovalsMemory };

function mem(): ApprovalsMemory {
  if (!g.__aidhdApprovals) g.__aidhdApprovals = { approvals: new Map() };
  return g.__aidhdApprovals;
}

function rowToApproval(row: Record<string, unknown>): ActionApproval {
  return {
    id: String(row.id),
    group_id: (row.group_id as string | null) ?? null,
    user_id: (row.user_id as string | null) ?? null,
    message_id: (row.message_id as string | null) ?? null,
    kind: row.kind as ApprovalKind,
    summary: String(row.summary),
    amount_usd: row.amount_usd != null ? Number(row.amount_usd) : null,
    payload:
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
    status: row.status as ApprovalStatus,
    requested_by: String(row.requested_by),
    decided_by: (row.decided_by as string | null) ?? null,
    decided_at: (row.decided_at as string | null) ?? null,
    result:
      row.result && typeof row.result === "object"
        ? (row.result as Record<string, unknown>)
        : null,
    expires_at: (row.expires_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function persist(approval: ActionApproval, insert: boolean) {
  if (supabaseConfigured()) {
    if (insert) {
      await sb("action_approvals", {
        method: "POST",
        body: JSON.stringify({
          id: approval.id,
          group_id: approval.group_id,
          user_id: approval.user_id,
          message_id: approval.message_id,
          kind: approval.kind,
          summary: approval.summary,
          amount_usd: approval.amount_usd,
          payload: approval.payload,
          status: approval.status,
          requested_by: approval.requested_by,
          expires_at: approval.expires_at,
        }),
      });
    } else {
      await sb(`action_approvals?id=eq.${approval.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          message_id: approval.message_id,
          status: approval.status,
          decided_by: approval.decided_by,
          decided_at: approval.decided_at,
          result: approval.result,
          updated_at: approval.updated_at,
        }),
      });
    }
  }
  mem().approvals.set(approval.id, approval);
}

export async function createApproval(input: {
  groupId?: string;
  userId?: string;
  kind: ApprovalKind;
  summary: string;
  amountUsd?: number;
  payload: Record<string, unknown>;
  requestedBy?: string;
  announceInGroup?: boolean;
}): Promise<ActionApproval> {
  const now = new Date().toISOString();
  const approval: ActionApproval = {
    id: randomUUID(),
    group_id: input.groupId ?? null,
    user_id: input.userId ?? null,
    message_id: null,
    kind: input.kind,
    summary: input.summary,
    amount_usd: input.amountUsd ?? null,
    payload: input.payload,
    status: "pending",
    requested_by: input.requestedBy || AIDHD_BOT_ID,
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    created_at: now,
    updated_at: now,
  };

  if (input.groupId && input.announceInGroup !== false) {
    const amountLine =
      approval.amount_usd != null
        ? `\nTotal: $${approval.amount_usd.toFixed(2)}`
        : "";
    const msg = await appendMessage({
      groupId: input.groupId,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: `⚠️ Approval needed — ${approval.summary}${amountLine}\nI won't do this until someone taps Approve.`,
      kind: "approval_request",
      meta: {
        approval_id: approval.id,
        approval_kind: approval.kind,
        approval_status: approval.status,
        amount_usd: approval.amount_usd,
      },
    });
    approval.message_id = msg?.id ?? null;
  }

  await persist(approval, true);
  if (input.groupId) {
    await broadcastGroupEvent(input.groupId, "approval", {
      approval_id: approval.id,
    });
  }
  return approval;
}

export async function getApproval(
  id: string,
): Promise<ActionApproval | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(`action_approvals?id=eq.${id}&limit=1`);
    if (ok && Array.isArray(data) && data[0]) {
      return rowToApproval(data[0] as Record<string, unknown>);
    }
  }
  return mem().approvals.get(id) ?? null;
}

export async function listPendingApprovals(
  scope: { groupId?: string; userId?: string },
): Promise<ActionApproval[]> {
  if (supabaseConfigured()) {
    const filter = scope.groupId
      ? `group_id=eq.${scope.groupId}`
      : `user_id=eq.${encodeURIComponent(scope.userId || "")}`;
    const { ok, data } = await sb(
      `action_approvals?${filter}&status=eq.pending&order=created_at.desc&limit=20`,
    );
    if (ok && Array.isArray(data)) {
      return (data as Record<string, unknown>[]).map(rowToApproval);
    }
  }
  return [...mem().approvals.values()].filter(
    (a) =>
      a.status === "pending" &&
      ((scope.groupId && a.group_id === scope.groupId) ||
        (scope.userId && a.user_id === scope.userId)),
  );
}

/**
 * Record the human decision. On approval, execute the stored payload.
 * Returns the final approval (executed / failed / declined).
 */
export async function decideApproval(input: {
  approvalId: string;
  decision: "approved" | "declined";
  decidedBy: string;
  decidedByName: string;
  origin?: string;
}): Promise<ActionApproval | null> {
  const approval = await getApproval(input.approvalId);
  if (!approval) return null;
  if (approval.status !== "pending") return approval;
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    approval.status = "expired";
    approval.updated_at = new Date().toISOString();
    await persist(approval, false);
    return approval;
  }

  approval.decided_by = input.decidedBy;
  approval.decided_at = new Date().toISOString();
  approval.updated_at = approval.decided_at;

  if (input.decision === "declined") {
    approval.status = "declined";
    await persist(approval, false);
    if (approval.group_id) {
      await appendMessage({
        groupId: approval.group_id,
        senderId: AIDHD_BOT_ID,
        senderName: AIDHD_BOT_NAME,
        body: `${input.decidedByName} declined: ${approval.summary}. Not doing it.`,
        kind: "system",
        meta: { approval_id: approval.id, approval_status: "declined" },
      });
      await broadcastGroupEvent(approval.group_id, "approval", {
        approval_id: approval.id,
      });
    }
    return approval;
  }

  approval.status = "approved";
  await persist(approval, false);

  const outcome = await executeApprovedAction(approval, input.origin);
  approval.status = outcome.ok ? "executed" : "failed";
  approval.result = {
    ok: outcome.ok,
    summary: outcome.summary,
    ...(outcome.data !== undefined ? { data: outcome.data } : {}),
  };
  approval.updated_at = new Date().toISOString();
  await persist(approval, false);

  if (approval.group_id) {
    await appendMessage({
      groupId: approval.group_id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: outcome.ok
        ? `✅ Approved by ${input.decidedByName} — ${outcome.summary}`
        : `❌ Approved by ${input.decidedByName}, but it failed: ${outcome.summary}`,
      kind: outcome.ok ? "tool_result" : "system",
      meta: { approval_id: approval.id, approval_status: approval.status },
    });
    await broadcastGroupEvent(approval.group_id, "approval", {
      approval_id: approval.id,
    });
  }
  return approval;
}

type Outcome = { ok: boolean; summary: string; data?: unknown };

/**
 * Execute the payload once a human approved it. Supported shapes:
 * - { action: "tool", tool, params }           → agent tool registry
 * - { action: "calendar_create", user_id, event } → Google Calendar
 * - { action: "call", venue_name, venue_phone, question, reply_channel? }
 * - { action: "sms", chat_id, text }           → Linq outbound
 */
async function executeApprovedAction(
  approval: ActionApproval,
  origin?: string,
): Promise<Outcome> {
  const p = approval.payload;
  const action = String(p.action || "tool");

  try {
    if (action === "tool") {
      const { executeAgentTool } = await import("@/lib/agent-tools/registry");
      const result = await executeAgentTool(
        String(p.tool || ""),
        (p.params as Record<string, unknown>) || {},
      );
      return { ok: result.ok, summary: result.summary, data: result.data };
    }

    if (action === "calendar_create") {
      const { createCalendarEvent } = await import(
        "@/lib/integrations/google-calendar"
      );
      const result = await createCalendarEvent(
        String(p.user_id || approval.decided_by || ""),
        (p.event as Parameters<typeof createCalendarEvent>[1]) || {
          title: approval.summary,
        },
      );
      return result.ok
        ? {
            ok: true,
            summary: `Added to Google Calendar: ${result.summary}`,
            data: result.data,
          }
        : { ok: false, summary: result.summary };
    }

    if (action === "call") {
      const { startBackgroundResearchCall } = await import(
        "@/lib/agents/research-call"
      );
      const job = await startBackgroundResearchCall({
        question: String(p.question || approval.summary),
        venue_name: String(p.venue_name || "the venue"),
        venue_phone: String(p.venue_phone || ""),
        reply_channel: "web",
        group_id: approval.group_id || undefined,
        venue_type: (p.venue_type as string | undefined) || undefined,
      });
      return {
        ok: job.status !== "failed",
        summary:
          job.status === "failed"
            ? job.findings || "Call failed to start"
            : `Calling ${job.venue_name} now — I'll post what they say here.` +
              (job.findings ? ` They said: ${job.findings}` : ""),
        data: { job_id: job.id, status: job.status, findings: job.findings },
      };
    }

    // Buy a product the group linked. This is the only path that spends money
    // at a merchant, and it is unreachable without this approval having been
    // granted by a human first.
    if (action === "buy_product") {
      const { startPurchase } = await import("@/lib/commerce/chat-purchase");
      if (!approval.group_id) {
        return { ok: false, summary: "Purchases need a group context." };
      }
      const groupId = approval.group_id;
      const bought = await startPurchase({
        groupId,
        buyerUserId: String(p.buyer_user_id || approval.decided_by || ""),
        buyerEmail: String(p.buyer_email || "shopper@aidhd.app"),
        buyerName: (p.buyer_name as string | undefined) || undefined,
        variantId: String(p.variant_id || ""),
        title: String(p.title || approval.summary),
        amount: Number(p.amount ?? approval.amount_usd ?? 0),
        merchant: String(p.merchant || "the store"),
        postPayLink: async (message) => {
          await appendMessage({
            groupId,
            senderId: AIDHD_BOT_ID,
            senderName: AIDHD_BOT_NAME,
            body: message,
            kind: "booking_prompt",
            meta: { approval_id: approval.id, purchase: true },
          });
        },
      });
      return { ok: bought.ok, summary: bought.summary };
    }

    if (action === "sms") {
      const { sendLinqChatMessage } = await import("@/lib/integrations/linq");
      const sent = await sendLinqChatMessage({
        chat_id: String(p.chat_id || ""),
        text: String(p.text || approval.summary),
      });
      return {
        ok: sent.ok,
        summary: sent.ok ? "Message sent." : "Linq send failed.",
      };
    }

    void origin;
    return { ok: false, summary: `Unknown approved action "${action}".` };
  } catch (e) {
    return {
      ok: false,
      summary: e instanceof Error ? e.message : "Action failed",
    };
  }
}
