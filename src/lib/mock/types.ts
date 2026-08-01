import type {
  Channel,
  ChatMessage,
  EventStatus,
  EventType,
  Package,
  PackageComponent,
  Booking,
} from "@/lib/types";

export type { Package, PackageComponent, Booking, ChatMessage, Channel, EventType, EventStatus };

export type AvatarColorKey = "coral" | "violet" | "success" | "gold";

export type InviteeStatus = "not_yet" | "responded";

export interface MockInvitee {
  id: string;
  name: string;
  role: "organizer" | "invitee";
  channel: Channel;
  colorKey: AvatarColorKey;
  status: InviteeStatus;
  agentTyping: boolean;
  /** Index into CHAT_SCRIPT — how far this invitee's canned conversation has progressed. */
  scriptStep: number;
  messages: ChatMessage[];
  budget_cap?: number;
  preferences?: { free_text: string; structured_tags: string[] };
  responded_at?: string;
}

export interface MockEvent {
  slug: string;
  type: EventType;
  title: string;
  destination_or_venue: string;
  proposed_dates: string[];
  organizer_id: string;
  invitees: MockInvitee[];
  status: EventStatus;
  packages: Package[];
  selected_package_id?: string;
  lastViewedPackageId?: string;
  bookings: Booking[];
  created_at: string;
}
