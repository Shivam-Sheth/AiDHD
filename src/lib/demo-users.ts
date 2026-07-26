import type { DemoUser } from "./types";

/** Hardcoded 3-person demo group for the live pitch. */
export const DEMO_USERS: DemoUser[] = [
  {
    id: "user_maya",
    name: "Maya",
    role: "organizer",
    channel: "web",
  },
  {
    id: "user_jordan",
    name: "Jordan",
    role: "invitee",
    channel: "whatsapp",
  },
  {
    id: "user_sam",
    name: "Sam",
    role: "invitee",
    channel: "imessage",
  },
];

export function getUser(id: string) {
  return DEMO_USERS.find((u) => u.id === id);
}
