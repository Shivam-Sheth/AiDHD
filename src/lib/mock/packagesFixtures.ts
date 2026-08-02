import type { MockEvent, Package, PackageComponent } from "./types";

function holdExpiry(): string {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

function component(
  partial: Pick<PackageComponent, "type" | "vendor" | "cost" | "details"> &
    Partial<PackageComponent>,
): PackageComponent {
  return {
    vendor_trust_score: 0.9,
    vendor_verified: true,
    verification_note: "Verified via Senso",
    currency: "USD",
    hold_expires_at: holdExpiry(),
    ...partial,
  };
}

interface Archetype {
  label: string;
  rationale: string;
  fit_score: number;
  multiplier: number;
  components: (total: number, event: MockEvent) => PackageComponent[];
}

const TRIP_ARCHETYPES: Archetype[] = [
  {
    label: "The Easy Yes",
    rationale: "Direct flights, a solid 3-star stay two blocks from the action, casual dinner.",
    fit_score: 0.92,
    multiplier: 0.85,
    components: (total) => [
      component({
        type: "flight",
        vendor: "Coastal Air",
        cost: Math.round(total * 0.35),
        details: "Round trip · direct",
      }),
      component({
        type: "hotel",
        vendor: "Harbor View Inn",
        cost: Math.round(total * 0.4),
        details: "3-star stay near the action",
      }),
      component({
        type: "dining",
        vendor: "The Local Table",
        cost: Math.round(total * 0.25),
        details: "Casual dinner, one night",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Day 1 — land, drop bags, walk the neighborhood",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Day 2 — free morning, casual group dinner",
      }),
    ],
  },
  {
    label: "The Middle Ground",
    rationale: "Ocean-view hotel, one paid excursion, a proper dinner reservation.",
    fit_score: 0.88,
    multiplier: 1,
    components: (total) => [
      component({
        type: "flight",
        vendor: "Coastal Air",
        cost: Math.round(total * 0.3),
        details: "Round trip",
      }),
      component({
        type: "hotel",
        vendor: "Sable & Palm Hotel",
        cost: Math.round(total * 0.45),
        details: "Ocean-view double · 4.6 rated",
      }),
      component({
        type: "dining",
        vendor: "Casa Lima",
        cost: Math.round(total * 0.25),
        details: "Reservation for the group",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Thu — land, drop bags, sunset on the beach",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Fri — morning excursion, free afternoon, group dinner",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Sat — brunch, boardwalk, flight home",
      }),
    ],
  },
  {
    label: "The Treat Yourself",
    rationale: "Beachfront resort, a sunset outing, the splurge dinner.",
    fit_score: 0.81,
    multiplier: 1.25,
    components: (total) => [
      component({
        type: "flight",
        vendor: "Coastal Air",
        cost: Math.round(total * 0.25),
        details: "Round trip · extra legroom",
      }),
      component({
        type: "hotel",
        vendor: "Beachfront Resort & Spa",
        cost: Math.round(total * 0.5),
        details: "Beachfront suite",
      }),
      component({
        type: "dining",
        vendor: "Casa Lima",
        cost: Math.round(total * 0.25),
        details: "Splurge tasting menu",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Day 1 — land, sunset boat trip",
      }),
      component({
        type: "itinerary_day",
        vendor: "Itinerary",
        cost: 0,
        details: "Day 2 — spa morning, splurge dinner",
      }),
    ],
  },
];

const OUTING_ARCHETYPES: Archetype[] = [
  {
    label: "The Easy Yes",
    rationale: "Standing room tickets and a casual bite before the show.",
    fit_score: 0.9,
    multiplier: 0.8,
    components: (total) => [
      component({
        type: "ticket",
        vendor: "Ticketmaster",
        cost: Math.round(total * 0.6),
        details: "Standing room",
      }),
      component({
        type: "dining",
        vendor: "The Local Table",
        cost: Math.round(total * 0.4),
        details: "Casual pre-show bite",
      }),
    ],
  },
  {
    label: "The Middle Ground",
    rationale: "Reserved seating and a proper pre-show dinner reservation.",
    fit_score: 0.85,
    multiplier: 1,
    components: (total) => [
      component({
        type: "ticket",
        vendor: "Ticketmaster",
        cost: Math.round(total * 0.55),
        details: "Reserved seating",
      }),
      component({
        type: "dining",
        vendor: "Casa Lima",
        cost: Math.round(total * 0.45),
        details: "Pre-show dinner reservation",
      }),
    ],
  },
  {
    label: "The Treat Yourself",
    rationale: "VIP floor access and the chef's tasting menu after.",
    fit_score: 0.76,
    multiplier: 1.3,
    components: (total) => [
      component({
        type: "ticket",
        vendor: "Ticketmaster",
        cost: Math.round(total * 0.6),
        details: "VIP floor + merch",
      }),
      component({
        type: "dining",
        vendor: "Casa Lima",
        cost: Math.round(total * 0.4),
        details: "Chef's tasting menu",
      }),
    ],
  },
];

/**
 * Regenerates the package list from whatever's currently known. Returns [] until at least one
 * invitee has responded — the Packages page renders its own "still waiting" state for that,
 * rather than showing fabricated numbers with zero real input behind them.
 */
export function generatePackages(event: MockEvent): Package[] {
  const responded = event.invitees.filter(
    (i) => i.status === "responded" && typeof i.budget_cap === "number",
  );
  if (responded.length === 0) return [];

  const combinedBudget = responded.reduce((sum, i) => sum + (i.budget_cap ?? 0), 0);
  const partySize = event.invitees.length;
  const archetypes = event.type === "trip" ? TRIP_ARCHETYPES : OUTING_ARCHETYPES;
  const respondedIds = responded.map((i) => i.id);

  return archetypes.map((arche, idx) => {
    const total = Math.max(Math.round(combinedBudget * arche.multiplier), 1);
    return {
      id: `pkg_${event.slug}_${idx}`,
      event_id: event.slug,
      label: arche.label,
      rationale: arche.rationale,
      components: arche.components(total, event),
      total_cost: total,
      cost_per_person: Math.round(total / partySize),
      fit_score: arche.fit_score,
      // No standalone voting UI in this pass — "Middle Ground" is seeded as the group's
      // implicit pick so the "most voted" badge has something real (actual invitee ids) behind it.
      votes: idx === 1 ? respondedIds : [],
    };
  });
}
