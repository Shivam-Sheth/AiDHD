"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always starts at "light" — the same value the server has to assume,
  // since it can't read localStorage/matchMedia. Reading the live
  // data-theme attribute here instead (already corrected by the
  // beforeInteractive script in layout.tsx before this component even
  // mounts) would make the client's first render disagree with the
  // server-rendered HTML and trigger a hydration mismatch across every
  // component that branches actual JSX on theme (HeroScene, LogoMarquee's
  // invert logic, ThemeToggle's icon). Colors never flash either way since
  // those are pure CSS driven by the attribute the script already set —
  // only this JS-side state, and the handful of components that branch
  // JSX on it, correct themselves one render after mount.
  const [theme, setTheme] = useState<Theme>("light");

  // Mount-only: sync React state to whatever the script already applied to
  // the DOM — doesn't write the attribute (it's already correct), just
  // brings JS-side state into agreement so theme-branching JSX corrects
  // itself right after hydration instead of staying stuck on "light".
  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "dark") {
      setTheme("dark");
    }
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem("theme", next);
      } catch {
        // localStorage can throw in private-browsing/blocked-storage contexts — theme just won't persist.
      }
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
