export type GroupMode = "outing" | "trip";
export type GroupStatus =
  | "collecting"
  | "planning"
  | "voting"
  | "review"
  | "paying"
  | "booking"
  | "confirmed"
  | "cancelled";
export type MemberRole = "organizer" | "spoc" | "member" | "bot";
export type MemberChannel = "web" | "whatsapp" | "imessage" | "system";
export type MessageKind =
  | "text"
  | "system"
  | "agent"
  | "booking_prompt"
  | "review_link"
  | "spoc_ask"
  | "tool_result";
export type BookingCategory = "flight" | "hotel" | "ticket" | "dining" | "trip";
export type BookingDraftStatus =
  | "draft"
  | "awaiting_info"
  | "awaiting_review"
  | "awaiting_payment"
  | "booked"
  | "failed";

export const AIDHD_BOT_ID = "bot_aidhd";
export const AIDHD_BOT_NAME = "AiDHD";

export type GroupParty = {
  id: string;
  slug: string;
  title: string;
  mode: GroupMode;
  place: string;
  proposed_dates: string[];
  status: GroupStatus;
  organizer_id: string;
  spoc_user_id?: string | null;
  chat_key_wrapped: string;
  legacy_event_id?: string | null;
  linq_chat_id?: string | null;
  whatsapp_thread_hint?: string | null;
  plan_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone?: string | null;
  role: MemberRole;
  channel: MemberChannel;
  joined_at: string;
};

export type GroupInvite = {
  token: string;
  group_id: string;
  created_by: string;
  max_uses: number;
  uses: number;
  expires_at?: string | null;
  created_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  body_ciphertext: string;
  /** Decrypted for API responses to members / bot. Never persisted. */
  body?: string;
  mentions: string[];
  kind: MessageKind;
  reply_to?: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type TravelerSlot = {
  user_id: string;
  display_name: string;
  passport_present: boolean;
  needs_passport: boolean;
  /** Opaque token for personal passport link — never a secret passport number */
  collect_token?: string;
};

export type GroupBookingDraft = {
  id: string;
  group_id: string;
  category: BookingCategory;
  status: BookingDraftStatus;
  party_size: number;
  travelers: TravelerSlot[];
  offer: Record<string, unknown>;
  review_token: string;
  prava_session_id?: string | null;
  prava_mandate_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GroupSessionUser = {
  id: string;
  email: string;
  name: string;
};
