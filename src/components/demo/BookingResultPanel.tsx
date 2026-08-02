import type { BookingData } from "@/lib/types-client";

export function BookingResultPanel({
  bookings,
  failedBooking,
  voiceClip,
  busy,
  onRerequestFailed,
  onReset,
}: {
  bookings: BookingData[];
  failedBooking: BookingData | null;
  voiceClip: string | null;
  busy: boolean;
  onRerequestFailed: () => void;
  onReset: () => void;
}) {
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  return (
    <div className="rounded-xl border border-success/25 bg-success-soft p-4 text-center">
      <p className="font-display text-lg font-semibold text-ink">Booked</p>
      <div className="mt-3 space-y-1 text-sm text-muted">
        {confirmed.map((b) => (
          <p key={b.id}>
            <span className="capitalize">{b.category}</span>: {b.confirmation_id}
          </p>
        ))}
      </div>

      {failedBooking && (
        <div className="mt-4 rounded-lg border border-danger/25 bg-danger-soft p-3 text-left">
          <p className="text-sm font-semibold text-danger capitalize">
            {failedBooking.category} failed{failedBooking.failure_reason ? ` — ${failedBooking.failure_reason}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            The rest of the group&apos;s categories stayed booked. Only this one needs a new mandate.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onRerequestFailed}
            className="mt-2 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-inverse disabled:opacity-50"
          >
            {busy ? "Re-requesting…" : `Re-mandate ${failedBooking.category} only`}
          </button>
        </div>
      )}

      {voiceClip && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium tracking-wider text-faint uppercase">Voice agent confirm</p>
          <audio controls src={voiceClip} className="mx-auto w-full max-w-sm" />
        </div>
      )}

      <button type="button" onClick={onReset} className="mt-5 text-sm font-semibold text-ink">
        Run again
      </button>
    </div>
  );
}
