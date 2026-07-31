/**
 * Instagram / TikTok reel → structured trip/outing brief.
 * Ready for WhatsApp links today; frontend can POST the same payload later.
 */

export type ReelSource = "instagram" | "tiktok" | "other" | "paste";

export type ReelEventMention = {
  title: string;
  venue?: string | null;
  city?: string | null;
  /** ISO dates mentioned in the reel */
  dates?: string[];
  times?: string[];
  ticket_hint?: string | null;
};

export type ReelBrief = {
  source_url?: string | null;
  source: ReelSource;
  title: string;
  summary: string;
  transcript_or_caption: string;
  city?: string | null;
  origin_city?: string | null;
  /** Estimated budget per person (same currency as budget_currency) */
  budget_cap?: number | null;
  /** ISO 4217 — INR, USD, etc. */
  budget_currency?: string | null;
  /** Total group budget if caption says "X for N people" */
  budget_total?: number | null;
  /** How we derived pp from the reel, e.g. "₹50,000 for 2 → ₹25,000/pp" */
  budget_note?: string | null;
  /** Trip length in days if mentioned */
  days?: number | null;
  /** Concrete dates from the reel (fair weekend, single show night, etc.) */
  dates: string[];
  /** Places / activities to visit */
  places: string[];
  events: ReelEventMention[];
  /** Suggested Ticketmaster search keywords */
  ticket_keywords: string[];
  mode: "outing" | "trip" | "local_event";
  party_size_hint?: number | null;
  confidence: number;
};

export type ReelClarifyField =
  | "party_size"
  | "date_pick"
  | "date_range"
  | "time_pick"
  | "budget"
  | "origin"
  | "confirm";

export type ReelClarifyAsk = {
  field: ReelClarifyField;
  prompt: string;
  options?: string[];
};

export type ReelTicketOption = {
  id: string;
  event_name: string;
  venue: string;
  date: string;
  price: number;
  currency: string;
  vendor: string;
  source: "ticketmaster" | "fixture";
};

export type ReelItineraryDay = {
  day_label: string;
  date?: string;
  items: string[];
};

export type ReelFlightOption = {
  id: string;
  airline: string;
  airline_iata?: string | null;
  airline_logo_url?: string | null;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  cabin: string;
  price_per_person: number;
  currency: string;
  source: "duffel" | "fixture";
};

export type ReelHotelOption = {
  id: string;
  name: string;
  neighborhood: string;
  check_in: string;
  check_out: string;
  nights: number;
  price_total: number;
  currency: string;
  source: "duffel" | "fixture";
  /** Guest review score 0–10 */
  rating?: number | null;
  review_count?: number | null;
  /** 1 = best reviewed in this result set */
  review_rank?: number | null;
};

export type ReelPlanResult = {
  brief: ReelBrief;
  asks: ReelClarifyAsk[];
  tickets: ReelTicketOption[];
  flights: ReelFlightOption[];
  hotels: ReelHotelOption[];
  itinerary: ReelItineraryDay[];
  ready_to_book: boolean;
  whatsapp_message: string;
  /** Raw caption so the client can finalize prefs without re-fetching the reel */
  cached_caption?: string;
};
