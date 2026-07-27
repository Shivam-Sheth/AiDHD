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

export interface FlightOffer {
  id: string;
  vendor: string;
  airline: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  cabin: string;
  price_per_person: number;
  currency: string;
  tags: string[];
}

export interface HotelOffer {
  id: string;
  vendor: string;
  name: string;
  neighborhood: string;
  check_in: string;
  check_out: string;
  nights: number;
  price_total: number;
  currency: string;
  tags: string[];
}

export interface ItineraryDayOffer {
  id: string;
  day: string;
  title: string;
  details: string;
  cost: number;
  currency: string;
  tags: string[];
}

/** NYC → Miami weekend trip fixtures (hackathon travel demo). */
export const FLIGHT_INVENTORY: FlightOffer[] = [
  {
    id: "flt_budget_b6",
    vendor: "Duffel / JetBlue",
    airline: "JetBlue",
    from: "JFK",
    to: "MIA",
    depart: "2026-08-14T08:15:00-04:00",
    arrive: "2026-08-14T11:20:00-04:00",
    cabin: "Basic",
    price_per_person: 129,
    currency: "USD",
    tags: ["budget", "morning", "nonstop"],
  },
  {
    id: "flt_match_aa",
    vendor: "Duffel / American",
    airline: "American",
    from: "LGA",
    to: "MIA",
    depart: "2026-08-14T10:40:00-04:00",
    arrive: "2026-08-14T13:55:00-04:00",
    cabin: "Main Cabin",
    price_per_person: 189,
    currency: "USD",
    tags: ["flexible", "afternoon", "nonstop"],
  },
  {
    id: "flt_splurge_dl",
    vendor: "Duffel / Delta",
    airline: "Delta",
    from: "JFK",
    to: "MIA",
    depart: "2026-08-14T16:05:00-04:00",
    arrive: "2026-08-14T19:10:00-04:00",
    cabin: "Comfort+",
    price_per_person: 279,
    currency: "USD",
    tags: ["splurge", "legroom", "nonstop"],
  },
];

export const HOTEL_INVENTORY: HotelOffer[] = [
  {
    id: "htl_budget_freehand",
    vendor: "Booking.com",
    name: "Freehand Miami",
    neighborhood: "Downtown",
    check_in: "2026-08-14",
    check_out: "2026-08-16",
    nights: 2,
    price_total: 280,
    currency: "USD",
    tags: ["budget", "social", "pool"],
  },
  {
    id: "htl_match_1hotel",
    vendor: "Expedia",
    name: "1 Hotel South Beach",
    neighborhood: "South Beach",
    check_in: "2026-08-14",
    check_out: "2026-08-16",
    nights: 2,
    price_total: 520,
    currency: "USD",
    tags: ["beach", "match", "walkable"],
  },
  {
    id: "htl_splurge_faena",
    vendor: "Amex Travel",
    name: "Faena Hotel Miami Beach",
    neighborhood: "Mid-Beach",
    check_in: "2026-08-14",
    check_out: "2026-08-16",
    nights: 2,
    price_total: 890,
    currency: "USD",
    tags: ["splurge", "design", "cabana"],
  },
];

export const ITINERARY_INVENTORY: ItineraryDayOffer[] = [
  {
    id: "itin_day1_beach",
    day: "2026-08-14",
    title: "Arrive + South Beach sunset",
    details: "Hotel check-in, Ocean Drive walk, casual ceviche",
    cost: 60,
    currency: "USD",
    tags: ["arrival", "beach"],
  },
  {
    id: "itin_day2_wynwood",
    day: "2026-08-15",
    title: "Wynwood walls + dinner",
    details: "Street art morning, Design District lunch, group dinner booking",
    cost: 90,
    currency: "USD",
    tags: ["culture", "dinner"],
  },
];
