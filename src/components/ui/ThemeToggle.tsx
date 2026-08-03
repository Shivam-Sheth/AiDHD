"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={clsx(
        "focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {/* Until mounted the icon would disagree with the pre-paint script, so
          render a stable placeholder rather than the wrong glyph. */}
      {mounted ? (
        theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
