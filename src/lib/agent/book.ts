import { randomUUID } from "crypto";
import { reserveDining } from "../integrations/dining";
import { reserveFlight } from "../integrations/flights";
import { reserveHotel } from "../integrations/hotels";
import { sendBookingConfirmationToGroup } from "../integrations/linq";
import {
  createPravaSession,
  invokeMandateToken,
  registerMandate,
} from "../integrations/prava";
import { reserveTicket } from "../integrations/ticketmaster";
import { runVoiceConfirmation } from "../integrations/voice";
import {
  getEvent,
  getMandate,
  getPackage,
  listBookings,
  listMandates,
  pushAgentLog,
  upsertBooking,
  upsertEvent,
  upsertMandate,
} from "../store";
import type { Mandate, MandateCategory, PackageComponent } from "../types";
import { getUser } from "../demo-users";

function categoryFor(comp: PackageComponent): MandateCategory | null {
  if (comp.type === "ticket" || comp.type === "dining" || comp.type === "flight" || comp.type === "hotel") {
    return comp.type;
  }
  return null;
}

export async function requestMandatesForPackage(eventId: string, packageId: string) {
  const event = getEvent(eventId);
  const pkg = getPackage(packageId);
  if (!event || !pkg) throw new Error("Event or package not found");

  upsertEvent({ ...event, status: "paying", selected_package_id: packageId });
  pushAgentLog(eventId, "mandates", "Requesting separate Prava mandate per cost category");

  const mandates: Mandate[] = [];

  for (const comp of pkg.components) {
    const category = categoryFor(comp);
    if (!category) continue;

    const session = await createPravaSession({
      user_id: event.organizer_id,
      user_email: "ameyagarwal10@gmail.com",
      merchant: comp.vendor,
      amount: comp.cost,
      currency: comp.currency,
      category,
    });

    if (session.error) {
      pushAgentLog(
        eventId,
        "prava_warn",
        `${category} session warning: ${session.error}`,
      );
    } else {
      pushAgentLog(
        eventId,
        "prava_session",
        `${category} · ${session.mode} session ${session.session_id}${
          session.iframe_url ? " · collect UI ready" : ""
        }`,
      );
    }

    const registered = await registerMandate({
      session_id: session.session_id,
      merchant: comp.vendor,
      amount_cap: comp.cost,
      currency: comp.currency,
      duration_minutes: category === "ticket" ? 30 : 45,
      category,
      iframe_url: session.iframe_url,
    });

    const mandate: Mandate = {
      id: randomUUID(),
      event_id: eventId,
      package_id: packageId,
      category,
      merchant: comp.vendor,
      amount_cap: comp.cost,
      currency: comp.currency,
      duration_minutes: category === "ticket" ? 30 : 45,
      prava_session_id: session.session_id,
      prava_mandate_id: registered.mandate_id,
      prava_intent_id: registered.intent_id,
      status: "requested",
      created_at: new Date().toISOString(),
    };
    upsertMandate(mandate);
    mandates.push(mandate);
  }

  return mandates;
}

export async function approveMandate(mandateId: string) {
  const mandate = getMandate(mandateId);
  if (!mandate) throw new Error("Mandate not found");
  const updated: Mandate = {
    ...mandate,
    status: "approved",
    approved_at: new Date().toISOString(),
  };
  upsertMandate(updated);
  return updated;
}

export async function approveAllMandates(eventId: string) {
  const mandates = listMandates(eventId).filter((m) => m.status === "requested");
  return Promise.all(mandates.map((m) => approveMandate(m.id)));
}

export async function executeBookings(
  eventId: string,
  opts?: { failTicket?: boolean },
) {
  const event = getEvent(eventId);
  if (!event?.selected_package_id) throw new Error("No selected package");
  const pkg = getPackage(event.selected_package_id);
  if (!pkg) throw new Error("Package missing");

  upsertEvent({ ...event, status: "booking" });
  pushAgentLog(eventId, "booking", "Invoking Prava tokens and booking connectors");

  const mandates = listMandates(eventId).filter(
    (m) => m.package_id === pkg.id && m.status === "approved",
  );

  const results: Array<Record<string, unknown>> = [];

  for (const mandate of mandates) {
    const comp = pkg.components.find((c) => c.type === mandate.category);
    if (!comp) continue;

    const token = await invokeMandateToken({
      intent_id: mandate.prava_intent_id!,
      merchant: mandate.merchant,
      amount: mandate.amount_cap,
      currency: mandate.currency,
    });

    let reservation:
      | { ok: true; confirmation_id: string; failure_reason?: undefined }
      | { ok: false; confirmation_id?: undefined; failure_reason: string };

    if (mandate.category === "ticket") {
      reservation = await reserveTicket(
        comp.merchant_id || "tix",
        Boolean(opts?.failTicket),
      );
    } else if (mandate.category === "dining") {
      const din = await reserveDining({
        offerId: comp.merchant_id || "din",
        restaurant: comp.vendor,
        spoc_name: getUser(event.organizer_id)?.name || "Organizer",
        party_size: Math.max(2, event.invitee_ids.length),
      });
      reservation = din.ok
        ? { ok: true, confirmation_id: din.confirmation_id }
        : { ok: false, failure_reason: din.failure_reason };
    } else if (mandate.category === "flight") {
      const r = await reserveFlight(comp.merchant_id || "flt");
      reservation = r.ok
        ? { ok: true, confirmation_id: r.confirmation_id }
        : { ok: false, failure_reason: r.failure_reason! };
    } else if (mandate.category === "hotel") {
      const r = await reserveHotel(comp.merchant_id || "htl");
      reservation = r.ok
        ? { ok: true, confirmation_id: r.confirmation_id }
        : { ok: false, failure_reason: r.failure_reason! };
    } else {
      reservation = {
        ok: true,
        confirmation_id: `MOCK-${String(mandate.category).toUpperCase()}-${Date.now().toString(36)}`,
      };
    }

    if (!reservation.ok) {
      upsertMandate({ ...mandate, status: "failed" });
      const booking = {
        id: randomUUID(),
        event_id: eventId,
        mandate_id: mandate.id,
        category: mandate.category,
        provider: comp.vendor,
        status: "failed" as const,
        failure_reason: reservation.failure_reason,
        created_at: new Date().toISOString(),
      };
      upsertBooking(booking);
      results.push({ booking, token, rematch_needed: true });
      pushAgentLog(
        eventId,
        "partial_failure",
        `${mandate.category} failed — only this mandate needs re-request; others untouched`,
      );
      continue;
    }

    upsertMandate({ ...mandate, status: "used" });
    const booking = {
      id: randomUUID(),
      event_id: eventId,
      mandate_id: mandate.id,
      category: mandate.category,
      provider: comp.vendor,
      confirmation_id: reservation.confirmation_id,
      status: "confirmed" as const,
      created_at: new Date().toISOString(),
    };
    upsertBooking(booking);
    results.push({ booking, token, rematch_needed: false });
  }

  const bookings = listBookings(eventId);
  // Latest booking wins per category (failed attempts can be superseded).
  const latestByCategory = new Map<string, (typeof bookings)[number]>();
  for (const b of [...bookings].sort(
    (a, c) => a.created_at.localeCompare(c.created_at),
  )) {
    latestByCategory.set(b.category, b);
  }
  const latest = [...latestByCategory.values()];
  const required = new Set(
    pkg.components
      .map((c) => categoryFor(c))
      .filter((c): c is MandateCategory => Boolean(c)),
  );
  const allConfirmed =
    required.size > 0 &&
    [...required].every(
      (cat) => latestByCategory.get(cat)?.status === "confirmed",
    );

  if (allConfirmed) {
    const fresh = getEvent(eventId)!;
    upsertEvent({ ...fresh, status: "confirmed" });
    const summary = latest
      .filter((b) => b.status === "confirmed")
      .map((b) => `${b.category}: ${b.confirmation_id}`)
      .join("\n");
    await sendBookingConfirmationToGroup({
      chat_id: "demo_group_imessage",
      summary,
    });
    pushAgentLog(eventId, "confirmed", "Fan-out confirmation to group channels");

    // Voice agent — Jarvis-style confirm call / clip for organizer
    const organizer = getUser(fresh.organizer_id);
    const voice = await runVoiceConfirmation({
      organizer_name: organizer?.name ?? "there",
      organizer_phone: process.env.VOICE_CONFIRM_PHONE,
      event_title: fresh.title,
      package_label: pkg.label,
      total_cost: pkg.total_cost,
      categories: [...required],
    });
    pushAgentLog(
      eventId,
      "agent:voice",
      `${voice.mode} · ${voice.detail} · "${voice.script.slice(0, 80)}…"`,
    );
    (results as Array<Record<string, unknown>>).push({
      voice,
    });
  }

  return results;
}

/** Demo helper: re-request only the failed category mandate. */
export async function rerequestFailedMandate(eventId: string) {
  const failed = listMandates(eventId).find((m) => m.status === "failed");
  if (!failed) throw new Error("No failed mandate");

  const session = await createPravaSession({
    user_id: getEvent(eventId)!.organizer_id,
    user_email: "ameyagarwal10@gmail.com",
    merchant: failed.merchant,
    amount: failed.amount_cap,
    currency: failed.currency,
    category: failed.category,
  });
  const registered = await registerMandate({
    session_id: session.session_id,
    merchant: failed.merchant,
    amount_cap: failed.amount_cap,
    currency: failed.currency,
    duration_minutes: failed.duration_minutes,
    category: failed.category,
  });

  const mandate: Mandate = {
    ...failed,
    id: randomUUID(),
    prava_session_id: session.session_id,
    prava_mandate_id: registered.mandate_id,
    prava_intent_id: registered.intent_id,
    status: "requested",
    created_at: new Date().toISOString(),
    approved_at: undefined,
  };
  upsertMandate(mandate);
  pushAgentLog(
    eventId,
    "re_mandate",
    `Re-requested only ${failed.category} mandate — sibling mandates still approved/used`,
  );
  return mandate;
}
