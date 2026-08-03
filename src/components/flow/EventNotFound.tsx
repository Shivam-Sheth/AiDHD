import Link from "next/link";

export function EventNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink uppercase">
          Not found
        </p>
        <h1 className="mt-3 text-2xl font-bold text-ink">We don&apos;t have that event.</h1>
        <p className="mt-2 text-sm text-muted">
          It may have expired, or the link&apos;s off — mock events only live in this browser.
        </p>
        <Link
          href="/events/new"
          className="mt-6 inline-block rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-inverse"
        >
          Start a new event
        </Link>
      </div>
    </div>
  );
}
