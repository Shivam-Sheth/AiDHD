"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { LoginModal } from "./LoginModal";
import { OAUTH_ERRORS } from "./LoginFields";

const STORAGE_KEY = "aidhd_logged_in";
/** Query param the OAuth callback redirects back with on failure — see the
 * effect below and src/app/auth/callback/page.tsx. There's no standalone
 * /login page to land on anymore, so the callback bounces to "/" with this
 * param and AuthProvider (mounted on every page) opens the modal itself. */
const OAUTH_ERROR_PARAM = "login_error";

/**
 * Global "is this visitor signed in" flag + the one shared login modal.
 * Mounted once at the root so any component (header, landing CTAs, …) can
 * gate an action behind login and pop the same dialog, instead of each
 * button owning its own modal/open-state.
 *
 * Real sessions (Google OAuth via Supabase) and the demo email/password
 * form (which has no backend — see LoginFields) both funnel through the
 * same `login()` call, persisted to localStorage so a signed-in visitor
 * doesn't get re-prompted on their next visit/navigation.
 */
const AuthContext = createContext<{
  loggedIn: boolean;
  login: () => void;
  openLogin: () => void;
  closeLogin: () => void;
  /** Runs `action` if already logged in, otherwise opens the login modal instead. */
  requireAuth: (action: () => void) => void;
}>({
  loggedIn: false,
  login: () => {},
  openLogin: () => {},
  closeLogin: () => {},
  requireAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function login() {
    setLoggedIn(true);
    setModalOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage can throw in private-browsing/blocked-storage contexts — session just won't persist.
    }
  }

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setLoggedIn(true);
    } catch {
      // see above
    }

    const url = new URL(window.location.href);
    const errorCode = url.searchParams.get(OAUTH_ERROR_PARAM);
    if (errorCode) {
      setModalError(OAUTH_ERRORS[errorCode] || null);
      setModalOpen(true);
      url.searchParams.delete(OAUTH_ERROR_PARAM);
      window.history.replaceState({}, "", url.toString());
    }

    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) login();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) login();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const openLogin = () => {
    setModalError(null);
    setModalOpen(true);
  };
  const closeLogin = () => setModalOpen(false);
  const requireAuth = (action: () => void) => {
    if (loggedIn) action();
    else openLogin();
  };

  return (
    <AuthContext.Provider
      value={{ loggedIn, login, openLogin, closeLogin, requireAuth }}
    >
      {children}
      <LoginModal open={modalOpen} onClose={closeLogin} initialError={modalError} />
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
