import type { AvatarColorKey, Channel } from "./types";

/**
 * Independent persona list for the mock product flow. Deliberately NOT imported from
 * src/lib/demo-users.ts — that file is live-imported by real backend code (store.ts,
 * orchestrator.ts, agent/book.ts, API routes). Reusing the names here is purely narrative
 * consistency with the pitch, with zero coupling to backend behavior.
 */

export interface Persona {
  id: string;
  name: string;
  role: "organizer" | "invitee";
  channel: Channel;
  colorKey: AvatarColorKey;
}

export const MOCK_ORGANIZER: Persona = {
  id: "mock_maya",
  name: "Maya",
  role: "organizer",
  channel: "web",
  colorKey: "coral",
};

export const MOCK_INVITEE_POOL: Persona[] = [
  { id: "mock_jordan", name: "Jordan", role: "invitee", channel: "whatsapp", colorKey: "violet" },
  { id: "mock_sam", name: "Sam", role: "invitee", channel: "imessage", colorKey: "gold" },
  { id: "mock_priya", name: "Priya", role: "invitee", channel: "web", colorKey: "success" },
];
