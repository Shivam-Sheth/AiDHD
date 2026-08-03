"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppBanner() {
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem("aidhd_install_dismissed");
    if (dismissed === "1") return;

    if (isIos()) {
      setShowIos(true);
      setHidden(false);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    localStorage.setItem("aidhd_install_dismissed", "1");
    setHidden(true);
    setDeferred(null);
    setShowIos(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-surface/95 p-3 backdrop-blur-md safe-pb">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Install AiDHD</p>
          <p className="mt-0.5 text-xs text-muted">
            {showIos
              ? "On iPhone: Share → Add to Home Screen. Opens like an app for invites + group chat."
              : "Add to your home screen — invite from Contacts, share links, plan on the go."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {!showIos && deferred && (
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-muted hover:text-ink"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
