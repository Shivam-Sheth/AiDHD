export type EventType = "trip" | "outing";
export type EventStatus =
  | "collecting"
  | "reconciling"
  | "voting"
  | "paying"
  | "booking"
  | "confirmed";
export type Channel = "web" | "whatsapp" | "imessage";
export type ComponentType =
  | "flight"
  | "hotel"
  | "ticket"
  | "dining"
  | "itinerary_day";
export type MandateCategory = "flight" | "hotel" | "ticket" | "dining";
export type MandateStatus =
  | "requested"
  | "approved"
  | "expired"
  | "used"
  | "failed";
export type BookingStatus = "pending" | "confirmed" | "failed";

export interface Event {
  id: string;
  type: EventType;
  title: string;
  destination_or_venue: string;
  proposed_dates: string[];
  organizer_id: string;
  invitee_ids: string[];
  status: EventStatus;
  created_via: Channel;
  selected_package_id?: string;
  created_at: string;
}

export interface Response {
  id: string;
  event_id: string;
  user_id: string;
  channel: Channel;
  budget_cap: number;
  budget_currency: string;
  preferences: {
    free_text: string;
    structured_tags: string[];
  };
  availability: string[];
  responded_at: string;
}

export interface PackageComponent {
  type: ComponentType;
  vendor: string;
  vendor_trust_score: number;
  vendor_verified: boolean;
  verification_note: string;
  cost: number;
  currency: string;
  details: string;
  hold_expires_at: string;
  merchant_id?: string;
}

export interface Package {
  id: string;
  event_id: string;
  label: string;
  rationale: string;
  components: PackageComponent[];
  total_cost: number;
  cost_per_person: number;
  fit_score: number;
  votes: string[];
}

export interface Mandate {
  id: string;
  event_id: string;
  package_id: string;
  category: MandateCategory;
  merchant: string;
  amount_cap: number;
  currency: string;
  duration_minutes: number;
  prava_session_id?: string;
  prava_mandate_id?: string;
  prava_intent_id?: string;
  status: MandateStatus;
  created_at: string;
  approved_at?: string;
}

export interface Booking {
  id: string;
  event_id: string;
  mandate_id: string;
  category: MandateCategory;
  provider: string;
  confirmation_id?: string;
  status: BookingStatus;
  failure_reason?: string;
  created_at: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: "organizer" | "invitee";
  channel: Channel;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  ts: string;
}

export interface CollectorSession {
  user_id: string;
  event_id: string;
  channel: Channel;
  step: "greet" | "budget" | "availability" | "preferences" | "confirm" | "done";
  draft: Partial<Omit<Response, "id" | "responded_at">>;
  messages: ChatMessage[];
}

export interface AgentRunLog {
  step: string;
  detail: string;
  at: string;
}
