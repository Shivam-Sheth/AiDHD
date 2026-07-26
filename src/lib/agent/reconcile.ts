import { randomUUID } from "crypto";
import { searchDining } from "../integrations/dining";
import { completeJson } from "../integrations/llm";
import { lookupVendorTrust } from "../integrations/senso";
import { searchTickets } from "../integrations/ticketmaster";
import { getUser } from "../demo-users";
import { pushAgentLog } from "../store";
import type { Event, Package, PackageComponent, Response } from "../types";

function holdExpiry(hours = 2) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function enrichComponent(
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

  const texts = responses.map((r) => r.preferences.free_text.toLowerCase());
  const wantsStanding = texts.some((t) => t.includes("standing"));
  const wantsSeated = texts.some(
    (t) => t.includes("seat") || t.includes("sit-down") || t.includes("sit down"),
  );
  if (wantsStanding && wantsSeated) {
    conflicts.push("Standing-room preference vs seated/VIP preference");
  }

  const brooklyn = texts.some((t) => t.includes("brooklyn"));
  const manhattan = texts.some(
    (t) => t.includes("manhattan") || t.includes("midtown"),
  );
  if (brooklyn && manhattan) {
    conflicts.push("Brooklyn bias vs Manhattan/Midtown preference");
  }

  return conflicts;
}

async function maybePolishLabels(
  eventId: string,
  packages: Package[],
  conflicts: string[],
): Promise<Package[]> {
  const result = await completeJson({
    system:
      'You refine short package labels/rationales for a group planning agent (nights out and trips). Return JSON {"packages":[{id,label,rationale}]}. Keep labels under 4 words. Mention conflicts honestly.',
    user: JSON.stringify({
      conflicts,
      packages: packages.map((p) => ({
        id: p.id,
        label: p.label,
        rationale: p.rationale,
        total_cost: p.total_cost,
        fit_score: p.fit_score,
      })),
    }),
  });

  if (!result) {
    pushAgentLog(
      eventId,
      "llm_polish",
      "LLM polish skipped (Gemini/OpenAI unavailable) — using deterministic package copy",
    );
    return packages;
  }

  try {
    pushAgentLog(
      eventId,
      "llm_polish",
      `Refined package copy via ${result.provider}`,
    );
    const parsed = JSON.parse(result.text) as {
      packages?: Array<{ id: string; label: string; rationale: string }>;
    };
    if (!parsed.packages) return packages;
    return packages.map((p) => {
      const polish = parsed.packages!.find((x) => x.id === p.id);
      return polish
        ? { ...p, label: polish.label, rationale: polish.rationale }
        : p;
    });
  } catch {
    return packages;
  }
}

export async function reconcileAndGeneratePackages(
  event: Event,
  responses: Response[],
): Promise<{ packages: Package[]; conflicts: string[]; envelope: number }> {
  pushAgentLog(event.id, "envelope", "Computing group budget envelope (sum of caps)");

  const envelope = responses.reduce((sum, r) => sum + r.budget_cap, 0);
  const perPersonAvg = envelope / Math.max(responses.length, 1);
  const conflicts = noteConflicts(responses);
  const tags = extractTags(responses);

  pushAgentLog(
    event.id,
    "conflicts",
    conflicts.length
      ? conflicts.join(" · ")
      : "No hard conflicts — preference intersection is clean",
  );

  pushAgentLog(event.id, "search_tickets", "Calling ticketing connector");
  const tickets = await searchTickets({
    keyword: "Neon Atlas",
    city: "New York",
    max_price: Math.max(...responses.map((r) => r.budget_cap)),
  });

  pushAgentLog(event.id, "search_dining", "Calling dining connector");
  const dining = await searchDining({
    max_per_person: Math.max(...responses.map((r) => r.budget_cap)) * 0.45,
    tags,
  });

  const party = responses.length || 3;

  // Package A — cheapest that fits everyone
  const cheapTicket =
    [...tickets.offers].sort((a, b) => a.price - b.price)[0] ?? tickets.offers[0];
  const cheapDinner =
    [...dining.offers].sort((a, b) => a.price_per_person - b.price_per_person)[0] ??
    dining.offers[0];

  // Package B — best average preference match
  const preferBrooklyn = tags.includes("brooklyn");
  const preferSeated = tags.includes("seated") || tags.includes("vip");
  const matchTicket =
    tickets.offers.find((t) =>
      preferSeated
        ? t.tags.includes("seated") || t.tags.includes("vip")
        : preferBrooklyn
          ? t.tags.includes("brooklyn")
          : true,
    ) ?? tickets.offers[1] ?? cheapTicket;
  const matchDinner =
    dining.offers.find((d) =>
      tags.includes("vegetarian")
        ? d.tags.includes("pasta") || d.tags.includes("shareable")
        : preferBrooklyn
          ? d.tags.includes("brooklyn")
          : true,
    ) ?? dining.offers[1] ?? cheapDinner;

  // Package C — splurge if group upgrades
  const splurgeTicket =
    [...tickets.offers].sort((a, b) => b.price - a.price)[0] ?? matchTicket;
  const splurgeDinner =
    dining.offers.find((d) => d.tags.includes("splurge")) ??
    [...dining.offers].sort((a, b) => b.price_per_person - a.price_per_person)[0];

  async function buildPackage(
    label: string,
    rationale: string,
    ticket: typeof cheapTicket,
    dinner: typeof cheapDinner,
    fit: number,
  ): Promise<Package> {
    const ticketComp = await enrichComponent({
      type: "ticket",
      vendor: ticket.vendor,
      cost: ticket.price * party,
      currency: ticket.currency,
      details: `${ticket.event_name} · ${ticket.tier} · ${ticket.venue} · ${new Date(ticket.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ×${party}`,
      hold_expires_at: holdExpiry(),
      merchant_id: ticket.id,
    });

    const diningComp = await enrichComponent({
      type: "dining",
      vendor: dinner.vendor,
      cost: dinner.price_per_person * party,
      currency: dinner.currency,
      details: `${dinner.vendor} · ${dinner.cuisine} · ${dinner.neighborhood} · ${new Date(dinner.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · party of ${party}`,
      hold_expires_at: holdExpiry(1.5),
      merchant_id: dinner.id,
    });

    const total = ticketComp.cost + diningComp.cost;
    return {
      id: randomUUID(),
      event_id: event.id,
      label,
      rationale,
      components: [ticketComp, diningComp],
      total_cost: total,
      cost_per_person: Math.round((total / party) * 100) / 100,
      fit_score: fit,
      votes: [],
    };
  }

  pushAgentLog(event.id, "senso", "Attaching Senso trust scores to candidate merchants");

  let packages: Package[] = await Promise.all([
    buildPackage(
      "Budget-friendly",
      `Cheapest stack that still clears everyone's night. Group envelope $${envelope} (avg $${Math.round(perPersonAvg)}/person). ${conflicts[0] ?? "Fits all caps at the low end."}`,
      cheapTicket,
      cheapDinner,
      0.78,
    ),
    buildPackage(
      "Best match",
      `Balances preference intersection (${tags.slice(0, 4).join(", ") || "general"}). Surfaces conflicts instead of dropping them: ${conflicts.join("; ") || "none"}.`,
      matchTicket,
      matchDinner,
      0.91,
    ),
    buildPackage(
      "Splurge",
      `If the group upgrades budget — premium seats + destination dinner. Total still explained against the $${envelope} envelope.`,
      splurgeTicket,
      splurgeDinner,
      0.7,
    ),
  ]);

  pushAgentLog(event.id, "packages", `Generated ${packages.length} distinct packages`);

  if (event.type === "trip") {
    // Stub trip components so trip mode shares the data model.
    packages = packages.map((p) => ({
      ...p,
      label: `${p.label} (trip stub)`,
      rationale: `${p.rationale} Trip mode stubs flights/hotel with fixture data.`,
    }));
  }

  packages = await maybePolishLabels(event.id, packages, conflicts);
  return { packages, conflicts, envelope };
}
