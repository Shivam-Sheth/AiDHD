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
  /** Estimated budget per person if mentioned */
  budget_cap?: number | null;
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

export type ReelPlanResult = {
  brief: ReelBrief;
  asks: ReelClarifyAsk[];
  tickets: ReelTicketOption[];
  itinerary: ReelItineraryDay[];
  ready_to_book: boolean;
  whatsapp_message: string;
};
