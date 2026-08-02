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
  photo_url?: string | null;
  rating?: number;
  review_count?: number;
  maps_url?: string;
  lat?: number;
  lng?: number;
}

export interface ClubOffer {
  id: string;
  name: string;
  neighborhood: string;
  vibe: string;
  cover: number;
  currency: string;
  open_until: string;
  tags: string[];
  photo_url?: string | null;
  rating?: number;
  review_count?: number;
  maps_url?: string;
  lat?: number;
  lng?: number;
}

export interface MovieOffer {
  id: string;
  title: string;
  theater: string;
  neighborhood: string;
  showtimes: string[];
  price: number;
  currency: string;
  rating: string;
  tags: string[];
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

export const CLUB_INVENTORY: ClubOffer[] = [
  {
    id: "club_output",
    name: "Output Room",
    neighborhood: "Williamsburg",
    vibe: "Techno · late",
    cover: 40,
    currency: "USD",
    open_until: "4:00 AM",
    tags: ["techno", "brooklyn", "dance", "late"],
  },
  {
    id: "club_somewhere",
    name: "Somewhere Nowhere",
    neighborhood: "Meatpacking",
    vibe: "House · rooftop energy",
    cover: 55,
    currency: "USD",
    open_until: "4:00 AM",
    tags: ["house", "manhattan", "splashy", "bottle"],
  },
  {
    id: "club_nowadays",
    name: "Nowadays",
    neighborhood: "Ridgewood",
    vibe: "Disco · outdoor",
    cover: 25,
    currency: "USD",
    open_until: "3:00 AM",
    tags: ["disco", "brooklyn", "chill", "budget"],
  },
  {
    id: "club_public_records",
    name: "Public Records",
    neighborhood: "Gowanus",
    vibe: "Hi-fi lounge · dancefloor",
    cover: 20,
    currency: "USD",
    open_until: "2:00 AM",
    tags: ["hi-fi", "brooklyn", "cocktails", "intimate"],
  },
];

export const MOVIE_INVENTORY: MovieOffer[] = [
  {
    id: "mov_dune",
    title: "Dune: Part Three",
    theater: "AMC Lincoln Square IMAX",
    neighborhood: "Upper West Side",
    showtimes: ["4:10 PM", "7:40 PM", "10:55 PM"],
    price: 22,
    currency: "USD",
    rating: "PG-13",
    tags: ["imax", "sci-fi", "manhattan", "blockbuster"],
  },
  {
    id: "mov_indie",
    title: "After the Soft Rain",
    theater: "Film Forum",
    neighborhood: "West Village",
    showtimes: ["5:30 PM", "8:00 PM"],
    price: 16,
    currency: "USD",
    rating: "R",
    tags: ["indie", "drama", "manhattan", "quiet"],
  },
  {
    id: "mov_comedy",
    title: "Wrong Turn at Brunch",
    theater: "Alamo Drafthouse Downtown Brooklyn",
    neighborhood: "Downtown Brooklyn",
    showtimes: ["6:15 PM", "9:00 PM"],
    price: 18,
    currency: "USD",
    rating: "R",
    tags: ["comedy", "brooklyn", "food", "casual"],
  },
  {
    id: "mov_action",
    title: "Night Courier",
    theater: "Regal UA Court Street",
    neighborhood: "Brooklyn Heights",
    showtimes: ["5:45 PM", "8:20 PM", "11:05 PM"],
    price: 17,
    currency: "USD",
    rating: "PG-13",
    tags: ["action", "brooklyn", "late"],
  },
];

export interface FlightOffer {
  id: string;
  vendor: string;
  airline: string;
  /** IATA airline code for logos */
  airline_iata?: string;
  airline_logo_url?: string;
  flight_number?: string;
  duration?: string;
  stops?: number;
  from: string;
  from_city?: string;
  to: string;
  to_city?: string;
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
  /** Guest review score 0–10 (Booking-style) */
  rating?: number;
  review_count?: number;
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
    vendor: "Fixture / JetBlue",
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
    vendor: "Fixture / American",
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
    vendor: "Fixture / Delta",
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
    rating: 8.2,
    review_count: 2140,
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
    rating: 9.1,
    review_count: 1860,
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
    rating: 9.4,
    review_count: 980,
  },
  {
    id: "htl_villa_ubud",
    vendor: "Airbnb",
    name: "Private Pool Villa",
    neighborhood: "Ubud",
    check_in: "2026-08-14",
    check_out: "2026-08-16",
    nights: 2,
    price_total: 340,
    currency: "USD",
    tags: ["villa", "pool", "reel-match"],
    rating: 9.6,
    review_count: 412,
  },
  {
    id: "htl_canggu_surf",
    vendor: "Booking.com",
    name: "Canggu Surf Lodge",
    neighborhood: "Canggu",
    check_in: "2026-08-14",
    check_out: "2026-08-16",
    nights: 2,
    price_total: 310,
    currency: "USD",
    tags: ["surf", "budget", "cafe"],
    rating: 8.7,
    review_count: 1530,
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
