import type { AvatarColorKey } from "@/lib/mock/types";

export const AVATAR_STYLES: Record<AvatarColorKey, { bg: string; text: string }> = {
  coral: { bg: "bg-coral/15", text: "text-coral-dark" },
  violet: { bg: "bg-violet/15", text: "text-violet" },
  success: { bg: "bg-success-soft", text: "text-success" },
  gold: { bg: "bg-gold/25", text: "text-coral-dark" },
};
