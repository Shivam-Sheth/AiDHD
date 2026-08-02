import type { AvatarColorKey } from "@/lib/mock/types";

/**
 * Avatars are separated by lightness rather than hue — four steps up the
 * neutral ramp stay distinguishable next to each other without reintroducing
 * decorative colour.
 */
export const AVATAR_STYLES: Record<AvatarColorKey, { bg: string; text: string }> = {
  coral: { bg: "bg-ink", text: "text-inverse" },
  violet: { bg: "bg-ink-700", text: "text-inverse" },
  success: { bg: "bg-line-strong", text: "text-ink" },
  gold: { bg: "bg-line", text: "text-ink-700" },
};
