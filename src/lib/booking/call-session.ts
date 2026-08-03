import { randomUUID } from "crypto";

/**
 * State for an agent-placed booking call.
 *
 * The card is deliberately NOT stored here and never goes into the agent's
 * prompt. The agent has to call a gated tool to get it, and that tool refuses
 * until a human has approved. Putting the PAN in the prompt would leak it into
 * the ElevenLabs conversation transcript before anyone approved the spend.
 */

export type CallStage =
  | "created"
  | "dialing"
  | "in_call"
  | "awaiting_approval"
  | "approved"
  | "card_released"
  | "confirmed"
  | "failed";

export type BookingCallSession = {
  id: string;
  stage: CallStage;
  created_at: string;

  /** What the agent is booking — read aloud, safe to log. */
  flight: {
    carrier: string;
    flight_number: string;
    origin: string;
    destination: string;
    departing_at: string;
    amount: string;
    currency: string;
  };

  /**
   * Cabin, bags and seat preference.
   *
   * Not Duffel service objects — a phone booking has none. These are stated to
   * the airline agent, who prices them. That is why the mandate carries an
   * estimate buffer and the agent escalates if the real total exceeds it.
   */
  extras: {
    cabin: string;
    checked_bags: number;
    seat_preference: string | null;
    estimated_extras_cost: string;
  };
  passenger: {
    given_name: string;
    family_name: string;
    born_on: string;
    email: string;
    phone_number: string;
  };
  airline_phone: string;

  /** Prava session the card will be pulled from at release time. */
  prava_session_id: string | null;

  /** Set only by an explicit human action. Gates the card tool. */
  approved_at: string | null;
  approved_by: string | null;

  /** Set once the card has been handed to the agent — single use. */
  card_released_at: string | null;

  confirmation_number: string | null;
  failure_reason: string | null;
  conversation_id: string | null;
  transcript_notes: string[];
};

/**
 * In-memory store. Booking calls are short-lived and a lost session should fail
 * closed (no card release) rather than persist a resumable spend authorisation.
 */
const SESSIONS = new Map<string, BookingCallSession>();

export function createCallSession(input: {
  flight: BookingCallSession["flight"];
  passenger: BookingCallSession["passenger"];
  airline_phone: string;
  prava_session_id?: string | null;
  extras?: Partial<BookingCallSession["extras"]>;
}): BookingCallSession {
  const session: BookingCallSession = {
    id: `bcall_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
    stage: "created",
    created_at: new Date().toISOString(),
    flight: input.flight,
    extras: {
      cabin: input.extras?.cabin ?? "economy",
      checked_bags: input.extras?.checked_bags ?? 0,
      seat_preference: input.extras?.seat_preference ?? null,
      estimated_extras_cost: input.extras?.estimated_extras_cost ?? "0.00",
    },
    passenger: input.passenger,
    airline_phone: input.airline_phone,
    prava_session_id: input.prava_session_id ?? null,
    approved_at: null,
    approved_by: null,
    card_released_at: null,
    confirmation_number: null,
    failure_reason: null,
    conversation_id: null,
    transcript_notes: [],
  };
  SESSIONS.set(session.id, session);
  return session;
}

export function getCallSession(id: string): BookingCallSession | null {
  return SESSIONS.get(id) ?? null;
}

/**
 * Resolve by ElevenLabs conversation id. Preferred over a model-supplied
 * session_id: the conversation id comes from the platform, so a confused agent
 * cannot point the card tool at somebody else's booking.
 */
export function getCallSessionByConversation(conversationId: string): BookingCallSession | null {
  for (const s of SESSIONS.values()) {
    if (s.conversation_id && s.conversation_id === conversationId) return s;
  }
  return null;
}

export function updateCallSession(
  id: string,
  patch: Partial<BookingCallSession>,
): BookingCallSession | null {
  const s = SESSIONS.get(id);
  if (!s) return null;
  Object.assign(s, patch);
  return s;
}

export function approveCardRelease(
  id: string,
  approver: string,
): { ok: true; session: BookingCallSession } | { ok: false; error: string } {
  const s = SESSIONS.get(id);
  if (!s) return { ok: false, error: "Unknown booking call" };
  if (s.card_released_at) {
    return { ok: false, error: "Card already released for this call." };
  }
  s.approved_at = new Date().toISOString();
  s.approved_by = approver;
  s.stage = "approved";
  return { ok: true, session: s };
}

/** Prava statuses that mean the traveller completed the passkey approval. */
const PRAVA_APPROVED = new Set([
  "completed",
  "approved",
  "captured",
  "authorized",
  "authorised",
  "succeeded",
]);

/**
 * Whether the card tool may hand over credentials.
 *
 * The human gate is the Prava passkey approval, not a separate button: it is a
 * deliberate, attributable authorisation of an exact amount to an exact
 * merchant, and it is what the traveller is already doing. `approved_at` stays
 * as a manual override for the cases where an operator needs to release
 * out-of-band.
 *
 * Fails closed on every ambiguous state, and allows one release per session.
 */
export function canReleaseCard(
  s: BookingCallSession,
  pravaStatus?: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (s.card_released_at) return { ok: false, reason: "already_released" };
  if (s.stage === "failed") return { ok: false, reason: "call_failed" };
  if (s.approved_at) return { ok: true };
  if (pravaStatus && PRAVA_APPROVED.has(pravaStatus.toLowerCase())) return { ok: true };
  return { ok: false, reason: "awaiting_mandate_approval" };
}

/** Only ever show the last 4 to any UI or log. */
export function maskPan(pan: string): string {
  const digits = pan.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• •••• •••• ${digits.slice(-4)}` : "••••";
}

export function noteOnSession(id: string, note: string) {
  const s = SESSIONS.get(id);
  if (!s) return;
  // Cheap guard against a transcript line carrying a PAN into our logs.
  const scrubbed = note.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card]");
  s.transcript_notes.push(`${new Date().toISOString()} ${scrubbed}`);
}
