export interface TicketOffer {
  id: string;
  event_name: string;
  vendor: string;
  venue: string;
  date: string;
  tier: string;
  price: number;
  currency: string;
  tags: string[];
}

export interface DiningOffer {
  id: string;
  vendor: string;
  cuisine: string;
  neighborhood: string;
  time: string;
  price_per_person: number;
  currency: string;
  tags: string[];
  party_size: number;
}

export const TICKET_INVENTORY: TicketOffer[] = [
  {
    id: "tix_brooklyn_steel_ga",
    event_name: "Neon Atlas — Brooklyn Steel",
    vendor: "Ticketmaster",
    venue: "Brooklyn Steel",
    date: "2026-08-07T20:00:00-04:00",
    tier: "General Admission",
    price: 65,
    currency: "USD",
    tags: ["indie", "standing", "brooklyn", "loud"],
  },
  {
    id: "tix_msg_lower",
    event_name: "Neon Atlas — Madison Square Garden",
    vendor: "Ticketmaster",
    venue: "Madison Square Garden",
    date: "2026-08-08T19:30:00-04:00",
    tier: "Lower Bowl",
    price: 145,
    currency: "USD",
    tags: ["arena", "seated", "manhattan", "splashy"],
  },
  {
    id: "tix_bowery_vip",
    event_name: "Neon Atlas — Bowery Ballroom (VIP)",
    vendor: "AXS",
    venue: "Bowery Ballroom",
    date: "2026-08-07T21:00:00-04:00",
    tier: "VIP Balcony",
    price: 110,
    currency: "USD",
    tags: ["intimate", "vip", "manhattan", "drinks"],
  },
];

export const DINING_INVENTORY: DiningOffer[] = [
  {
    id: "din_lilia",
    vendor: "Lilia",
    cuisine: "Italian",
    neighborhood: "Williamsburg",
    time: "2026-08-07T17:30:00-04:00",
    price_per_person: 55,
    currency: "USD",
    tags: ["pasta", "pre-show", "brooklyn", "cozy"],
    party_size: 3,
  },
  {
    id: "din_rule_of_thirds",
    vendor: "Rule of Thirds",
    cuisine: "Japanese",
    neighborhood: "Greenpoint",
    time: "2026-08-07T18:00:00-04:00",
    price_per_person: 42,
    currency: "USD",
    tags: ["izakaya", "budget", "brooklyn", "shareable"],
    party_size: 3,
  },
  {
    id: "din_carbone",
    vendor: "Carbone",
    cuisine: "Italian-American",
    neighborhood: "Greenwich Village",
    time: "2026-08-08T17:00:00-04:00",
    price_per_person: 95,
    currency: "USD",
    tags: ["splurge", "manhattan", "celebrity", "classic"],
    party_size: 3,
  },
  {
    id: "din_emma",
    vendor: "Emma's Torch",
    cuisine: "Seasonal American",
    neighborhood: "Red Hook",
    time: "2026-08-07T18:30:00-04:00",
    price_per_person: 48,
    currency: "USD",
    tags: ["mission-driven", "quiet", "brooklyn", "wine"],
    party_size: 3,
  },
];
