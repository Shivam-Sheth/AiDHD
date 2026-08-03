import { parseAvailability } from "./web-chat";
import {
  classifyWhatsAppIntent,
  handleCollectorMessage,
  MODE_CHECKLIST_OUTING,
  MODE_CHECKLIST_TRIP,
  startCollector,
} from "./web-chat";
import { lookupPackagesForWhatsApp } from "./whatsapp-packages";
import {
  extractReelUrl,
  isReelMessage,
  planFromReel,
  parseReelFollowUp,
} from "../reel";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "../integrations/whatsapp";
import {
  getContactByPhone,
  getContactByUserId,
  listWhatsAppContacts,
  normalizePhone,
  registerWhatsAppContact,
  seedJordanPhoneIfConfigured,
  setContactCheckpoint,
  setContactEventId,
} from "../integrations/whatsapp-phonebook";
import {
  ensureSeeded,
  getCollector,
  getEvent,
  getPackage,
  getResponseForUser,
  listPackages,
  listResponses,
  setCollector,
  upsertEvent,
  upsertPackage,
  upsertResponse,
} from "../store";
import type { CollectorSession, Package } from "../types";
import { ensureHydrated, flushDurableNow } from "../state-sync";
import { getBaseUrl } from "../base-url";

const DEFAULT_EVENT =
  process.env.WHATSAPP_DEFAULT_EVENT_ID || "evt_demo_friday";

const OUTING_EVENT = "evt_demo_friday";
const TRIP_EVENT = "evt_demo_miami";

function lastAssistantTexts(
  beforeCount: number,
  afterMessages: { role: string; content: string }[],
): string[] {
  return afterMessages
    .slice(beforeCount)
    .filter((m) => m.role === "assistant")
    .map((m) => m.content);
}

/** One Graph call beats 2–3 sequential sends. */
async function replyOnce(to: string, parts: string[]) {
  const body = parts.filter(Boolean).join("\n\n").trim();
  if (!body) return;
  await sendWhatsAppMessage({ to, body });
}

function cachePackagesOnContacts(eventId: string, packages: Package[]) {
  const slim = packages.slice(0, 3).map((p) => ({
    id: p.id,
    label: p.label,
    cost_per_person: p.cost_per_person,
    total_cost: p.total_cost,
  }));
  for (const c of listWhatsAppContacts()) {
    if (c.event_id === eventId || !c.event_id) {
      c.last_packages = slim;
    }
  }
}

async function notifyDateOutliers(input: {
  outlierUserIds: string[];
  majorityLabel: string;
  exceptUserId?: string;
}) {
  for (const uid of input.outlierUserIds) {
    if (uid === input.exceptUserId) continue;
    const c = getContactByUserId(uid);
    if (!c) continue;
    c.pending_date_exception = input.majorityLabel;
    await sendWhatsAppMessage({
      to: c.phone,
      body:
        `Quick date check — most of the group is free ${input.majorityLabel}.\n` +
        `Your dates don't fully overlap.\n\n` +
        `Reply EXCEPTION to join that window, or send a new date range (e.g. Aug 11–15).`,
    });
  }
}

async function notifyBudgetOutliers(input: {
  outlierUserIds: string[];
  budgetTarget: number;
  exceptUserId?: string;
}) {
  if (!input.budgetTarget) return;
  for (const uid of input.outlierUserIds) {
    if (uid === input.exceptUserId) continue;
    const c = getContactByUserId(uid);
    if (!c) continue;
    c.pending_budget_target = input.budgetTarget;
    await sendWhatsAppMessage({
      to: c.phone,
      body:
        `Budget check — the group's middle-ground is ~$${input.budgetTarget}/person.\n` +
        `Can you raise your budget to $${input.budgetTarget} so packages fit everyone?\n\n` +
        `Reply RAISE to match, KEEP to stay at your number, or BUDGET 150 to set a custom cap.`,
    });
  }
}

async function shareGroupPackages(input: {
  eventId: string;
  message: string;
  packages: Package[];
  outlierUserIds: string[];
  budgetOutlierUserIds?: string[];
  budgetTarget?: number;
  majorityLabel: string;
  preferPhone?: string;
}) {
  cachePackagesOnContacts(input.eventId, input.packages);
  await notifyDateOutliers({
    outlierUserIds: input.outlierUserIds,
    majorityLabel: input.majorityLabel,
  });
  await notifyBudgetOutliers({
    outlierUserIds: input.budgetOutlierUserIds ?? [],
    budgetTarget: input.budgetTarget ?? 0,
  });

  const responseIds = new Set(listResponses(input.eventId).map((r) => r.user_id));
  const targets = listWhatsAppContacts().filter(
    (c) =>
      responseIds.has(c.user_id) &&
      (c.event_id === input.eventId || !c.event_id),
  );
  const phones = new Set(targets.map((c) => c.phone));
  if (input.preferPhone) phones.add(normalizePhone(input.preferPhone));

  for (const to of phones) {
    await sendWhatsAppMessage({ to, body: input.message });
  }
}

function shareArgsFromLookup(
  eventId: string,
  result: Awaited<ReturnType<typeof lookupPackagesForWhatsApp>>,
  preferPhone?: string,
  dateOutlierFilter?: (id: string) => boolean,
) {
  return {
    eventId,
    message: result.message,
    packages: result.packages,
    outlierUserIds: dateOutlierFilter
      ? result.outlierUserIds.filter(dateOutlierFilter)
      : result.outlierUserIds,
    budgetOutlierUserIds: result.budgetOutlierUserIds,
    budgetTarget: result.budgetTarget,
    majorityLabel: result.majorityLabel,
    preferPhone,
  };
}

function activeEventId(contact: { event_id?: string }): string {
  return contact.event_id || DEFAULT_EVENT;
}

function ensureInvitee(eventId: string, userId: string) {
  const event = getEvent(eventId);
  if (!event) throw new Error("Demo event missing");
  if (!event.invitee_ids.includes(userId)) {
    upsertEvent({
      ...event,
      invitee_ids: [...event.invitee_ids, userId],
    });
  }
  return getEvent(eventId)!;
}

/** First freeform after Meta hello_world — choose mode only. */
const OPENER = `Hey! I'm AiDHD — I'll help your group plan.

First: is this a group TRIP or a group OUTING (one night)?

Reply:
• TRIP — flights + hotels (optional activities in the city)
• OUTING or PLAN — tickets + dinner
• Or paste an Instagram/TikTok reel link — I'll decode it and find tickets

I'll then ask for what I need, starting with budget.`;

const MID_STEPS = new Set([
  "budget",
  "origin",
  "destination",
  "availability",
  "preferences",
  "confirm",
]);

function restoreSessionFromCheckpoint(contact: {
  user_id: string;
  phone: string;
  name: string;
  event_id?: string;
  collector_checkpoint?: {
    event_id: string;
    step: CollectorSession["step"];
    draft: Record<string, unknown>;
  };
}): CollectorSession | undefined {
  const cp = contact.collector_checkpoint;
  if (!cp || !MID_STEPS.has(cp.step) || cp.step === "done") return undefined;
  const existing = getCollector(cp.event_id, contact.user_id);
  if (existing && MID_STEPS.has(existing.step)) return existing;

  const session: CollectorSession = {
    user_id: contact.user_id,
    event_id: cp.event_id,
    channel: "whatsapp",
    step: cp.step,
    draft: {
      ...(cp.draft as CollectorSession["draft"]),
      event_id: cp.event_id,
      user_id: contact.user_id,
      channel: "whatsapp",
      budget_currency: "USD",
    },
    messages: [],
  };
  setCollector(session);
  setContactEventId(contact.phone, cp.event_id);
  return session;
}

function syncCheckpoint(
  phone: string,
  session: CollectorSession | undefined,
) {
  if (!session || session.step === "done") {
    setContactCheckpoint(phone, undefined);
    return;
  }
  if (!MID_STEPS.has(session.step)) return;
  setContactCheckpoint(phone, {
    event_id: session.event_id,
    step: session.step as NonNullable<
      import("../integrations/whatsapp-phonebook").WhatsAppContact["collector_checkpoint"]
    >["step"],
    draft: { ...session.draft } as Record<string, unknown>,
  });
}

/**
 * WhatsApp collects prefs, then can trigger the agent subnet (tickets/flights/hotels)
 * and text packages back. Voice/ElevenLabs still optional.
 */
export async function inviteWhatsAppPhones(input: {
  phones: { phone: string; name?: string }[];
  event_id?: string;
}): Promise<{
  invited: string[];
  failed: { phone: string; error: string }[];
  event_id: string;
  from_display: string;
  tip: string;
}> {
  ensureSeeded();
  seedJordanPhoneIfConfigured();
  const eventId = input.event_id || DEFAULT_EVENT;
  const event = getEvent(eventId);
  if (!event) throw new Error("Event not found");

  const invited: string[] = [];
  const failed: { phone: string; error: string }[] = [];

  for (const row of input.phones) {
    const contact = registerWhatsAppContact({
      phone: row.phone,
      name: row.name,
    });
    setContactEventId(contact.phone, eventId);
    ensureInvitee(eventId, contact.user_id);
    contact.planning_intro_sent = false;
    try {
      await sendWhatsAppTemplate({ to: contact.phone });
      invited.push(contact.phone);
    } catch (err) {
      failed.push({
        phone: contact.phone,
        error: err instanceof Error ? err.message : "send failed",
      });
    }
  }

  if (!invited.length && failed.length) {
    throw new Error(
      failed.map((f) => `${f.phone}: ${f.error}`).join(" · ") +
        " — Add each number in Meta → WhatsApp → Recipient list (with country code).",
    );
  }

  return {
    invited,
    failed,
    event_id: eventId,
    from_display: "+1 (555) 158-1137",
    tip: "hello_world first; after they reply, AiDHD asks TRIP vs OUTING, then budget.",
  };
}

function beginMode(input: {
  phone: string;
  contact: { user_id: string; name: string; phone: string };
  eventId: string;
  checklist: string;
  kind: "outing" | "trip";
}): string {
  setContactEventId(input.phone, input.eventId);
  ensureInvitee(input.eventId, input.contact.user_id);
  startCollector(input.eventId, input.contact.user_id, {
    channel: "whatsapp",
    name: input.contact.name,
    force: true,
  });
  const session = getCollector(input.eventId, input.contact.user_id);
  syncCheckpoint(input.phone, session);
  const headline =
    input.kind === "trip"
      ? "Got it — let's plan a group trip."
      : "Got it — let's plan a group outing.";
  return `${headline}\n\n${input.checklist}`;
}

export async function handleWhatsAppInbound(input: {
  from: string;
  text: string;
  profileName?: string;
}): Promise<{ replies: string[]; user_id: string; event_id: string }> {
  ensureSeeded();
  await ensureHydrated();
  seedJordanPhoneIfConfigured();

  const phone = normalizePhone(input.from);
  const contact =
    getContactByPhone(phone) ??
    registerWhatsAppContact({
      phone,
      name: input.profileName,
    });
  if (input.profileName && contact.name.startsWith("Friend ")) {
    contact.name = input.profileName;
  }

  // Restore mid-flow session wiped by a cold serverless instance
  restoreSessionFromCheckpoint(contact);

  let eventId = activeEventId(contact);
  if (contact.collector_checkpoint?.event_id) {
    eventId = contact.collector_checkpoint.event_id;
    setContactEventId(phone, eventId);
  }
  ensureInvitee(eventId, contact.user_id);

  const text = input.text.trim();
  const lower = text.toLowerCase();
  const replies: string[] = [];

  // Active collect session — never hijack mid-flow into TRIP/OUTING
  const existingSession = getCollector(eventId, contact.user_id);
  const midCollect = Boolean(
    existingSession &&
      existingSession.step !== "done" &&
      MID_STEPS.has(existingSession.step),
  );

  // Explicit mode switch only as a short standalone command
  const explicitOuting = /^(outing|friday|plan)[!?.]*$/i.test(lower);
  const explicitTrip = /^(trip|miami|travel)[!?.]*$/i.test(lower);

  // Gemini for greetings / mode — skip mode inference while collecting prefs
  const classified = midCollect
    ? null
    : await classifyWhatsAppIntent(text);
  const isGreeting =
    classified?.intent === "greeting" ||
    /^(hi|hii|hello|hey|ok|okay|yo|sup|start|help|thanks|thank you|hola|good\s*(morning|afternoon|evening))[\s!.?]*$/i.test(
      lower,
    );

  // First reply after template → mode chooser only (one message).
  // Never restart with OPENER while mid-collect or when a checkpoint exists.
  if (contact.planning_intro_sent !== true) {
    contact.planning_intro_sent = true;
    if (isGreeting && !explicitOuting && !explicitTrip && !midCollect) {
      replies.push(OPENER);
      await replyOnce(phone, replies);
      await flushDurableNow();
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
  } else if (
    isGreeting &&
    !midCollect &&
    !explicitOuting &&
    !explicitTrip &&
    !contact.collector_checkpoint &&
    !contact.pending_reel
  ) {
    replies.push(OPENER);
    await replyOnce(phone, replies);
    await flushDurableNow();
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // —— Reel link / follow-up (Gemini decode + Ticketmaster) ——
  if (!midCollect && (isReelMessage(text) || contact.pending_reel)) {
    const url = extractReelUrl(text) || contact.pending_reel?.url || null;
    const follow = contact.pending_reel
      ? parseReelFollowUp(text, contact.pending_reel.brief)
      : {};
    const party_size =
      follow.party_size ?? contact.pending_reel?.party_size;
    const selected_date =
      follow.selected_date ?? contact.pending_reel?.selected_date;
    const selected_time =
      follow.selected_time ?? contact.pending_reel?.selected_time;
    const budget_cap =
      follow.budget_cap ?? contact.pending_reel?.budget_cap;
    const origin_city =
      follow.origin_city ?? contact.pending_reel?.origin_city;

    if (url || contact.pending_reel || /^(reel|reels)\b/i.test(lower)) {
      if (!url && !contact.pending_reel) {
        replies.push(
          "Paste an Instagram or TikTok reel link (or a caption/transcript after REEL).",
        );
        await replyOnce(phone, replies);
        return { replies, user_id: contact.user_id, event_id: eventId };
      }
      await replyOnce(phone, [
        url && !contact.pending_reel
          ? "Decoding that reel with Gemini — pulling events + Ticketmaster times…"
          : "Updating your reel plan…",
      ]);
      const transcript =
        !url && /^reel\b/i.test(lower)
          ? text.replace(/^(reel|reels)\s*/i, "").trim()
          : undefined;
      const plan = await planFromReel({
        url,
        transcript:
          transcript ||
          (!url ? contact.pending_reel?.brief.transcript_or_caption : undefined),
        party_size,
        selected_date,
        selected_time,
        budget_cap,
        origin_city,
      });
      contact.pending_reel = {
        url: url ?? contact.pending_reel?.url,
        brief: plan.brief,
        party_size,
        selected_date,
        selected_time,
        budget_cap,
        origin_city,
      };
      if (/^approve\b/i.test(lower) && plan.tickets.length) {
        const idx =
          Number(lower.match(/^approve\s*([1-5])\b/)?.[1] ?? "1") - 1;
        const pick = plan.tickets[idx] ?? plan.tickets[0]!;
        contact.pending_reel = undefined;
        replies.push(
          `Locked: ${pick.event_name} @ ${pick.venue} · ${pick.date} · ~$${Math.round(pick.price)}.\n` +
            `Next: Prava ticket mandate on ${getBaseUrl()}`,
        );
        await replyOnce(phone, replies);
        await flushDurableNow();
        return { replies, user_id: contact.user_id, event_id: eventId };
      }
      replies.push(plan.whatsapp_message);
      await replyOnce(phone, [plan.whatsapp_message]);
      await flushDurableNow();
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
  }

  // Mode switch: only explicit short commands, or Gemini when NOT mid-collect
  const wantsOuting =
    explicitOuting ||
    (!midCollect &&
      (classified?.intent === "mode_outing" || classified?.mode === "outing"));
  const wantsTrip =
    explicitTrip ||
    (!midCollect &&
      (classified?.intent === "mode_trip" || classified?.mode === "trip"));

  if (!midCollect && wantsOuting && !wantsTrip) {
    eventId = OUTING_EVENT;
    const body = beginMode({
      phone,
      contact,
      eventId,
      checklist: MODE_CHECKLIST_OUTING,
      kind: "outing",
    });
    replies.push(body);
    await replyOnce(phone, replies);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  if (!midCollect && wantsTrip) {
    eventId = TRIP_EVENT;
    const body = beginMode({
      phone,
      contact,
      eventId,
      checklist: MODE_CHECKLIST_TRIP,
      kind: "trip",
    });
    replies.push(body);
    await replyOnce(phone, replies);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // Dual-agent research
  if (/^research\b/i.test(lower) || /^call\s+(and\s+)?ask\b/i.test(lower)) {
    const { startBackgroundResearchCall } = await import(
      "../agents/research-call"
    );
    const raw = text.replace(/^(research|call\s+(and\s+)?ask)\s*/i, "");
    const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      replies.push(
        "Format:\nRESEARCH Venue Name | +1phone | your question",
      );
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    await replyOnce(phone, [
      `On it — research agent is calling ${parts[0]} in the background.`,
    ]);
    const job = await startBackgroundResearchCall({
      venue_name: parts[0],
      venue_phone: parts[1],
      question: parts.slice(2).join(" | "),
      reply_to_phone: phone,
      reply_channel: "whatsapp",
    });
    if (job.status === "calling") {
      replies.push(`Call started (${job.id.slice(0, 8)}…).`);
      await replyOnce(phone, [replies[replies.length - 1]]);
    } else if (job.status === "done" && job.findings) {
      replies.push(job.findings);
    } else if (job.status === "failed") {
      replies.push(`Research failed: ${job.findings || "unknown"}`);
      await replyOnce(phone, [replies[replies.length - 1]]);
    }
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  if (
    /^(packages|package|lookup|look\s*up|find|events|tickets|ticketmaster|reconcile|generate|search)\b/i.test(
      lower,
    )
  ) {
    await replyOnce(phone, [
      `Building one shared package set for the group…`,
    ]);
    const result = await lookupPackagesForWhatsApp(eventId);
    if (!result.ok) {
      replies.push(result.message);
      await replyOnce(phone, [result.message]);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    await shareGroupPackages(shareArgsFromLookup(eventId, result, phone));
    replies.push(result.message);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // Date exception: join consensus window
  if (/^exception\b/i.test(lower) && contact.pending_date_exception) {
    const window = contact.pending_date_exception;
    contact.pending_date_exception = undefined;
    const existing = getResponseForUser(eventId, contact.user_id);
    if (existing && window) {
      upsertResponse({
        ...existing,
        availability: existing.availability,
        responded_at: new Date().toISOString(),
      });
    }
    const result = await lookupPackagesForWhatsApp(eventId);
    replies.push(
      `Thanks — joining consensus dates (${window}). Refreshing shared packages…`,
    );
    await replyOnce(phone, replies);
    if (result.ok) {
      await shareGroupPackages(
        shareArgsFromLookup(
          eventId,
          result,
          phone,
          (id) => id !== contact.user_id,
        ),
      );
      replies.push(result.message);
    } else {
      await replyOnce(phone, [result.message]);
    }
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // Budget: raise to group middle-ground
  if (
    contact.pending_budget_target &&
    (/^raise\b/i.test(lower) ||
      /^budget\s*\$?\d{2,4}\b/i.test(lower) ||
      /^keep\b/i.test(lower))
  ) {
    const existing = getResponseForUser(eventId, contact.user_id);
    const custom = lower.match(/^budget\s*\$?(\d{2,4})\b/i);
    if (/^keep\b/i.test(lower)) {
      contact.pending_budget_target = undefined;
      replies.push("Keeping your current budget. Shared packages unchanged.");
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    const nextCap = custom
      ? Number(custom[1])
      : contact.pending_budget_target;
    contact.pending_budget_target = undefined;
    if (existing && nextCap) {
      upsertResponse({
        ...existing,
        budget_cap: nextCap,
        responded_at: new Date().toISOString(),
      });
    }
    await replyOnce(phone, [
      `Budget updated to $${nextCap}. Rebuilding shared group packages…`,
    ]);
    const result = await lookupPackagesForWhatsApp(eventId);
    if (result.ok) {
      await shareGroupPackages(
        shareArgsFromLookup(
          eventId,
          result,
          phone,
          (id) => id !== contact.user_id,
        ),
      );
      replies.push(result.message);
    } else {
      await replyOnce(phone, [result.message]);
      replies.push(result.message);
    }
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // Re-enter dates while pending exception
  if (contact.pending_date_exception) {
    const dates = parseAvailability(text);
    if (dates.length) {
      const existing = getResponseForUser(eventId, contact.user_id);
      if (existing) {
        upsertResponse({
          ...existing,
          availability: dates,
          responded_at: new Date().toISOString(),
        });
      }
      contact.pending_date_exception = undefined;
      await replyOnce(phone, [
        `Got your new dates. Rebuilding the shared group packages…`,
      ]);
      const result = await lookupPackagesForWhatsApp(eventId);
      if (result.ok) {
        await shareGroupPackages(shareArgsFromLookup(eventId, result, phone));
        replies.push(result.message);
      } else {
        await replyOnce(phone, [result.message]);
        replies.push(result.message);
      }
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
  }

  const voteMatch = lower.match(/^vote\s*([123])\b/);
  if (voteMatch) {
    const idx = Number(voteMatch[1]) - 1;
    let packages = listPackages(eventId);

    // Serverless may have lost memory — regenerate same group packages, then vote
    if (!packages.length) {
      const refreshed = await lookupPackagesForWhatsApp(eventId);
      if (refreshed.ok && refreshed.packages.length) {
        packages = refreshed.packages;
        cachePackagesOnContacts(eventId, packages);
      } else if (contact.last_packages?.length) {
        // Last resort: acknowledge vote against cached labels
        const cached = contact.last_packages[idx];
        if (cached) {
          replies.push(
            `Voted for ${idx + 1}) ${cached.label} (~$${Math.round(cached.cost_per_person)}/pp).\n` +
              `Prava mandates: ${getBaseUrl()}`,
          );
          await replyOnce(phone, replies);
          return { replies, user_id: contact.user_id, event_id: eventId };
        }
      }
    }

    const pkg = packages[idx];
    if (!pkg) {
      replies.push(
        "Couldn't find that option — reply PACKAGES to refresh the shared list, then VOTE 1 / 2 / 3.",
      );
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    for (const p of packages) {
      upsertPackage({
        ...p,
        votes: p.votes.filter((v) => v !== contact.user_id),
      });
    }
    const fresh = getPackage(pkg.id) ?? pkg;
    upsertPackage({
      ...fresh,
      votes: [...fresh.votes.filter((v) => v !== contact.user_id), contact.user_id],
    });
    const event = getEvent(eventId)!;
    upsertEvent({ ...event, selected_package_id: fresh.id, status: "voting" });
    cachePackagesOnContacts(eventId, listPackages(eventId));
    replies.push(
      `Voted for ${idx + 1}) ${pkg.label} (~$${Math.round(pkg.cost_per_person)}/pp).\nPrava mandates: ${getBaseUrl()}`,
    );
    await replyOnce(phone, replies);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // Must pick mode before collecting (unless already mid-session)
  let session = getCollector(eventId, contact.user_id);
  if (!session || session.step === "done") {
    const restored = restoreSessionFromCheckpoint(contact);
    if (restored) {
      session = restored;
      eventId = restored.event_id;
    }
  }
  if (!session || session.step === "done") {
    // No active collect — nudge mode choice (don't silently assume outing)
    if (!/\$?\d{2,4}|under|budget/i.test(text)) {
      replies.push(OPENER);
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    // Budget without mode → default outing but say so
    eventId = OUTING_EVENT;
    setContactEventId(phone, eventId);
    ensureInvitee(eventId, contact.user_id);
    session = startCollector(eventId, contact.user_id, {
      channel: "whatsapp",
      name: contact.name,
      force: true,
    });
    syncCheckpoint(phone, session);
    await replyOnce(phone, [
      `Treating this as an OUTING (say TRIP anytime to switch).\n\n${MODE_CHECKLIST_OUTING}`,
    ]);
  }

  const before = session.messages.length;
  const result = await handleCollectorMessage(eventId, contact.user_id, text);
  syncCheckpoint(phone, result.session);
  const newReplies = lastAssistantTexts(before, result.session.messages);

  if (newReplies.length) {
    replies.push(...newReplies);
    await replyOnce(phone, newReplies);
  }

  if (result.response) {
    setContactCheckpoint(phone, undefined);
    const count = listResponses(eventId).length;
    await replyOnce(phone, [
      `Prefs locked (${count} response${count === 1 ? "" : "s"}). Building one shared package set for the group…`,
    ]);
    const lookup = await lookupPackagesForWhatsApp(eventId);
    if (!lookup.ok) {
      await replyOnce(phone, [lookup.message]);
      replies.push(lookup.message);
      await flushDurableNow();
      return { replies, user_id: contact.user_id, event_id: eventId };
    }

    // If this user is a date outlier, ask them personally first
    if (lookup.outlierUserIds.includes(contact.user_id)) {
      contact.pending_date_exception = lookup.majorityLabel;
      const ask =
        `Most of the group is free ${lookup.majorityLabel}, but your dates don't fully overlap.\n` +
        `Reply EXCEPTION to join that window, or send a new date range.\n` +
        `Shared packages (consensus window) are below either way:`;
      await replyOnce(phone, [ask]);
      replies.push(ask);
    }
    if (lookup.budgetOutlierUserIds.includes(contact.user_id)) {
      contact.pending_budget_target = lookup.budgetTarget;
      const ask =
        `Group budget middle-ground is ~$${lookup.budgetTarget}/person.\n` +
        `Reply RAISE to match, KEEP to stay, or BUDGET 150 for a custom cap.`;
      await replyOnce(phone, [ask]);
      replies.push(ask);
    }

    await shareGroupPackages(shareArgsFromLookup(eventId, lookup, phone));
    replies.push(lookup.message);
  }

  await flushDurableNow();
  return { replies, user_id: contact.user_id, event_id: eventId };
}
