/** Client-safe mirrors of server types for the demo UI. */

export type EventStatus =
  | "collecting"
  | "reconciling"
  | "voting"
  | "paying"
  | "booking"
  | "confirmed";

export interface DemoUser {
  id: string;
  name: string;
  role: "organizer" | "invitee";
  channel: "web" | "whatsapp" | "imessage";
}

export interface EventData {
  id: string;
  type: "trip" | "outing";
  title: string;
  destination_or_venue: string;
  proposed_dates: string[];
  organizer_id: string;
  invitee_ids: string[];
  status: EventStatus;
  created_via: string;
  selected_package_id?: string;
  created_at: string;
}

export interface ResponseData {
  id: string;
  event_id: string;
  user_id: string;
  channel: string;
  budget_cap: number;
  budget_currency: string;
  preferences: { free_text: string; structured_tags: string[] };
  availability: string[];
  responded_at: string;
}

export interface PackageComponent {
  type: string;
  vendor: string;
  vendor_trust_score: number;
  vendor_verified: boolean;
  verification_note: string;
  cost: number;
  currency: string;
  details: string;
  hold_expires_at: string;
}

export interface PackageData {
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

export interface MandateData {
  id: string;
  event_id: string;
  package_id: string;
  category: string;
  merchant: string;
  amount_cap: number;
  currency: string;
  duration_minutes: number;
  prava_session_id?: string;
  prava_mandate_id?: string;
  prava_intent_id?: string;
  status: string;
  created_at: string;
  approved_at?: string;
}

export interface BookingData {
  id: string;
  event_id: string;
  mandate_id: string;
  category: string;
  provider: string;
  confirmation_id?: string;
  status: string;
  failure_reason?: string;
  created_at: string;
}

export interface AgentLog {
  step: string;
  detail: string;
  at: string;
}

export interface Snapshot {
  event: EventData;
  users: DemoUser[];
  responses: ResponseData[];
  packages: PackageData[];
  mandates: MandateData[];
  bookings: BookingData[];
  agent_logs: AgentLog[];
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
  channel: string;
  step: string;
  messages: ChatMessage[];
}
