"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoginFields } from "./LoginFields";

/**
 * Small centered "window" over the landing page, not a route navigation —
 * the backdrop uses backdrop-blur so the page behind it visibly blurs
 * (unlike a plain opacity overlay). Portaled to document.body so its fixed
 * positioning/z-index can't be clipped or out-stacked by an ancestor.
 */
export function LoginModal({
  open,
  onClose,
  initialError = null,
}: {
  open: boolean;
  onClose: () => void;
  initialError?: string | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up relative w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl shadow-black/40 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        <p className="font-display text-xs font-semibold tracking-[0.14em] text-[var(--accent-hover)] uppercase">
          Welcome back
        </p>
        <h2
          id="login-modal-title"
          className="font-display mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]"
        >
          Sign in
        </h2>

        <div className="mt-6">
          <LoginFields initialError={initialError} onSuccess={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
