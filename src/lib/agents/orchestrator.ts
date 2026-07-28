import { randomUUID } from "crypto";
import { searchDining } from "../integrations/dining";
import { searchFlights } from "../integrations/flights";
import { searchHotels } from "../integrations/hotels";
import { completeJson } from "../integrations/llm";
import { lookupVendorTrust } from "../integrations/senso";
import { searchTickets } from "../integrations/ticketmaster";
import { getUser } from "../demo-users";
import { pushAgentLog } from "../store";
import type { Event, Package, PackageComponent, Response } from "../types";
import type { AgentId, AgentRunResult } from "./types";
import { planDatesLabel } from "../agent/plan-dates";

function holdExpiry(hours = 2) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function enrich(
  partial: Omit<
    PackageComponent,
    "vendor_trust_score" | "vendor_verified" | "verification_note"
  >,
): Promise<PackageComponent> {
  const trust = await lookupVendorTrust(partial.vendor);
  return {
    ...partial,
    vendor_trust_score: trust.trust_score,
    vendor_verified: trust.verified,
    verification_note: trust.note,
  };
}

function logAgent(
  eventId: string,
  agent: AgentId,
  detail: string,
): AgentRunResult {
  pushAgentLog(eventId, `agent:${agent}`, detail);
  return { agent, ok: true, detail };
}

function extractTags(responses: Response[]): string[] {
  const tags = new Set<string>();
  for (const r of responses) {
    for (const t of r.preferences.structured_tags) tags.add(t.toLowerCase());
    const text = r.preferences.free_text.toLowerCase();
    for (const keyword of [
      "brooklyn",
      "manhattan",
      "vegetarian",
      "standing",
      "seated",
      "vip",
      "splurge",
      "quiet",
      "dinner",
      "beach",
      "miami",
      "budget",
      "movie",
      "cinema",
      "concert",
      "theatre",
      "theater",
      "escape",
      "comedy",
      "museum",
    ]) {
      if (text.includes(keyword)) tags.add(keyword);
    }
  }
  return [...tags];
}

function noteConflicts(responses: Response[]): string[] {
  const conflicts: string[] = [];
  const budgets = responses.map((r) => ({
    name: getUser(r.user_id)?.name ?? r.user_id,
    cap: r.budget_cap,
  }));
  const min = Math.min(...budgets.map((b) => b.cap));
  const max = Math.max(...budgets.map((b) => b.cap));
  if (max - min >= 80) {
    conflicts.push(
      `Budget spread: ${budgets.map((b) => `${b.name} $${b.cap}`).join(", ")}`,
    );
  }
  return conflicts;
}

async function polish(
  eventId: string,
  packages: Package[],
  conflicts: string[],
): Promise<Package[]> {
  const result = await completeJson({
    system:
      'You refine short package labels/rationales for a multi-agent group planner. Return JSON {"packages":[{id,label,rationale}]}. Labels ≤4 words.',
    user: JSON.stringify({
      conflicts,
      packages: packages.map((p) => ({
        id: p.id,
        label: p.label,
        rationale: p.rationale,
        total_cost: p.total_cost,
      })),
    }),
  });
  if (!result) {
    logAgent(eventId, "orchestrator", "LLM polish skipped");
    return packages;
  }
  try {
    logAgent(eventId, "orchestrator", `Polish via ${result.provider}`);
    const parsed = JSON.parse(result.text) as {
      packages?: Array<{ id: string; label: string; rationale: string }>;
    };
    if (!parsed.packages) return packages;
    return packages.map((p) => {
      const hit = parsed.packages!.find((x) => x.id === p.id);
      return hit ? { ...p, label: hit.label, rationale: hit.rationale } : p;
    });
  } catch {
    return packages;
  }
}

/** Outing subnet: tickets + dining + trust + polish */
async function runOutingAgents(
  event: Event,
  responses: Response[],
): Promise<{ packages: Package[]; conflicts: string[]; envelope: number }> {
  const envelope = responses.reduce((s, r) => s + r.budget_cap, 0);
  const conflicts = noteConflicts(responses);
  const tags = extractTags(responses);
  const party = responses.length || 3;
  const maxCap = Math.max(...responses.map((r) => r.budget_cap));
  const datesLabel = planDatesLabel(responses, event.proposed_dates);

  logAgent(event.id, "orchestrator", "Dispatching tickets + dining + trust agents");

  const [tickets, dining] = await Promise.all([
    searchTickets({
      keyword: "concert",
      city: "New York",
      max_price: maxCap,
    }).then((r) => {
      logAgent(event.id, "tickets", `source=${r.source} offers=${r.offers.length}`);
      return r;
    }),
    searchDining({ max_per_person: maxCap * 0.45, tags }).then((r) => {
      logAgent(event.id, "dining", `source=${r.source} offers=${r.offers.length}`);
      return r;
    }),
  ]);

  logAgent(event.id, "trust", "Senso trust attached per component");

  if (!tickets.offers.length || !dining.offers.length) {
    throw new Error(
      `No outing inventory (tickets=${tickets.offers.length} dining=${dining.offers.length})`,
    );
  }

  const cheapT = [...tickets.offers].sort((a, b) => a.price - b.price)[0]!;
  const midT = tickets.offers[1] ?? cheapT;
  const highT = [...tickets.offers].sort((a, b) => b.price - a.price)[0]!;
  const cheapD = [...dining.offers].sort(
    (a, b) => a.price_per_person - b.price_per_person,
  )[0]!;
  const midD = dining.offers[1] ?? cheapD;
  const highD = [...dining.offers].sort(
    (a, b) => b.price_per_person - a.price_per_person,
  )[0]!;

  async function build(
    label: string,
    rationale: string,
    t: typeof cheapT,
    d: typeof cheapD,
    fit: number,
  ): Promise<Package> {
    const comps = await Promise.all([
      enrich({
        type: "ticket",
        vendor: t.vendor,
        cost: t.price * party,
        currency: t.currency,
        details: `${t.event_name} · ${t.tier} · ${t.venue} · ${datesLabel}`,
        hold_expires_at: holdExpiry(),
        merchant_id: t.id,
      }),
      enrich({
        type: "dining",
        vendor: d.vendor,
        cost: d.price_per_person * party,
        currency: d.currency,
        details: `${d.vendor} · ${d.cuisine} · ${d.neighborhood} · ${datesLabel}`,
        hold_expires_at: holdExpiry(1.5),
        merchant_id: d.id,
      }),
    ]);
    const total = comps.reduce((s, c) => s + c.cost, 0);
    return {
      id: randomUUID(),
      event_id: event.id,
      label,
      rationale,
      components: comps,
      total_cost: total,
      cost_per_person: Math.round((total / party) * 100) / 100,
      fit_score: fit,
      votes: [],
    };
  }

  let packages: Package[] = await Promise.all([
    build(
      "Budget-friendly",
      `Dates: ${datesLabel}. Fits envelope $${envelope}.`,
      cheapT,
      cheapD,
      0.78,
    ),
    build(
      "Best match",
      `Dates: ${datesLabel}. Prefs: ${tags.slice(0, 4).join(", ") || "general"}. ${conflicts[0] ?? ""}`,
      midT,
      midD,
      0.91,
    ),
    build(
      "Splurge",
      `Dates: ${datesLabel}. Premium stack vs $${envelope} envelope.`,
      highT,
      highD,
      0.7,
    ),
  ]);

  packages = await polish(event.id, packages, conflicts);
  return { packages, conflicts, envelope };
}

/** Travel subnet: flights + hotels (+ optional destination tickets if vibe asks) */
async function runTripAgents(
  event: Event,
  responses: Response[],
): Promise<{ packages: Package[]; conflicts: string[]; envelope: number }> {
  const envelope = responses.reduce((s, r) => s + r.budget_cap, 0);
  const conflicts = noteConflicts(responses);
  const tags = extractTags(responses);
  const party = responses.length || 3;
  const maxCap = Math.max(...responses.map((r) => r.budget_cap));
  const datesLabel = planDatesLabel(responses, event.proposed_dates);

  const vibeBlob = responses
    .map((r) => r.preferences.free_text)
    .join(" ")
    .toLowerCase();
  const wantsActivity =
    /movie|cinema|concert|show|theatre|theater|comedy|sports|game|museum|escape/.test(
      vibeBlob,
    ) ||
    tags.some((t) =>
      /movie|concert|theatre|theater|comedy|sports|museum|escape/.test(t),
    );
  const ticketKeyword = /movie|cinema/.test(vibeBlob)
    ? "movie"
    : /escape/.test(vibeBlob)
      ? "escape room"
      : /comedy/.test(vibeBlob)
        ? "comedy"
        : /museum/.test(vibeBlob)
          ? "museum"
          : /concert|show|theatre|theater/.test(vibeBlob)
            ? "concert"
            : "concert";

  logAgent(
    event.id,
    "orchestrator",
    wantsActivity
      ? "Trip mode — flights + hotels + destination activity"
      : "Trip mode — flights + hotels",
  );

  const originTag = tags.find((t) => t.startsWith("origin:"));
  const destTag = tags.find((t) => t.startsWith("dest:"));
  const destCityTag = tags.find((t) => t.startsWith("destination:"));
  const originCode = originTag?.split(":")[1] || "JFK";
  const destCode = destTag?.split(":")[1] || "MIA";
  const hotelCity =
    responses
      .map((r) => r.preferences.destination)
      .find(Boolean) ||
    destCityTag?.split(":")[1] ||
    "Miami";

  const [flights, hotels, tickets] = await Promise.all([
    searchFlights({
      origin: originCode,
      destination: destCode,
      max_price: maxCap,
    }).then((r) => {
      logAgent(
        event.id,
        "flights",
        `source=${r.source} offers=${r.offers.length} ${originCode}→${destCode}`,
      );
      return r;
    }),
    searchHotels({ city: hotelCity, max_total: envelope * 0.7 }).then((r) => {
      logAgent(
        event.id,
        "hotels",
        `source=${r.source} offers=${r.offers.length} city=${hotelCity}`,
      );
      return r;
    }),
    wantsActivity
      ? searchTickets({
          keyword: ticketKeyword,
          city: hotelCity,
          max_price: maxCap * 0.35,
        }).then((r) => {
          logAgent(
            event.id,
            "tickets",
            `dest activity source=${r.source} offers=${r.offers.length} city=${hotelCity} kw=${ticketKeyword}`,
          );
          return r;
        })
      : Promise.resolve({ offers: [], source: "fixture" as const }),
  ]);

  const tiers = [
    {
      label: "Budget trip",
      fit: 0.8,
      f: flights.offers[0],
      h: hotels.offers[0],
      t: tickets.offers[0],
    },
    {
      label: "Best match",
      fit: 0.92,
      f: flights.offers[1] ?? flights.offers[0],
      h: hotels.offers[1] ?? hotels.offers[0],
      t: tickets.offers[1] ?? tickets.offers[0],
    },
    {
      label: "Splurge trip",
      fit: 0.72,
      f: flights.offers[2] ?? flights.offers[0],
      h: hotels.offers[2] ?? hotels.offers[0],
      t: tickets.offers[2] ?? tickets.offers[0],
    },
  ].filter((t) => t.f && t.h);

  if (!tiers.length) {
    throw new Error(
      `No trip inventory (flights=${flights.offers.length} hotels=${hotels.offers.length})`,
    );
  }

  let packages: Package[] = [];
  for (const tier of tiers) {
    const flightCost = tier.f!.price_per_person * party;
    const hotelShare = tier.h!.price_total;

    const comps = await Promise.all([
      enrich({
        type: "flight",
        vendor: tier.f!.vendor,
        cost: flightCost,
        currency: tier.f!.currency,
        details: `${tier.f!.airline} ${tier.f!.from}→${tier.f!.to} · ${tier.f!.cabin} · ${new Date(tier.f!.depart).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ×${party} · ${datesLabel}`,
        hold_expires_at: holdExpiry(3),
        merchant_id: tier.f!.id,
      }),
      enrich({
        type: "hotel",
        vendor: tier.h!.vendor,
        cost: hotelShare,
        currency: tier.h!.currency,
        details: `${tier.h!.name} · ${tier.h!.neighborhood} · ${tier.h!.nights} nights · ${tier.h!.check_in}→${tier.h!.check_out}`,
        hold_expires_at: holdExpiry(4),
        merchant_id: tier.h!.id,
      }),
      ...(tier.t
        ? [
            enrich({
              type: "ticket" as const,
              vendor: tier.t.vendor,
              cost: tier.t.price * party,
              currency: tier.t.currency,
              details: `${tier.t.event_name} · ${tier.t.tier} · ${tier.t.venue} (${hotelCity}) · ${datesLabel}`,
              hold_expires_at: holdExpiry(2),
              merchant_id: tier.t.id,
            }),
          ]
        : []),
    ]);

    const total = comps.reduce((s, c) => s + c.cost, 0);
    packages.push({
      id: randomUUID(),
      event_id: event.id,
      label: tier.label,
      rationale: `Dates: ${datesLabel}. ${originCode}→${destCode} · flights + hotel${tier.t ? ` + ${hotelCity} activity` : ""} vs group envelope $${envelope}. ${conflicts[0] ?? "Caps compatible."}`,
      components: comps,
      total_cost: total,
      cost_per_person: Math.round((total / party) * 100) / 100,
      fit_score: tier.fit,
      votes: [],
    });
  }

  logAgent(event.id, "trust", "Senso trust on trip vendors");
  packages = await polish(event.id, packages, conflicts);
  return { packages, conflicts, envelope };
}

/**
 * Orchestrator entry — replaces monolithic reconcile for both outing + trip.
 * Channels must only collect; this is where agents do the work.
 */
export async function runPlanningSubnet(
  event: Event,
  responses: Response[],
): Promise<{ packages: Package[]; conflicts: string[]; envelope: number }> {
  pushAgentLog(
    event.id,
    "agent:orchestrator",
    `Starting subnet for ${event.type} · ${responses.length} responses`,
  );

  if (event.type === "trip") {
    return runTripAgents(event, responses);
  }
  return runOutingAgents(event, responses);
}
