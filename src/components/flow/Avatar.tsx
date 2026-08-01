import clsx from "clsx";
import type { AvatarColorKey } from "@/lib/mock/types";
import { AVATAR_STYLES } from "./avatarColor";

export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: AvatarColorKey;
  size?: "sm" | "md";
}) {
  const style = AVATAR_STYLES[color];
  return (
    <span
      aria-hidden
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-sans font-semibold",
        style.bg,
        style.text,
        size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs",
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
