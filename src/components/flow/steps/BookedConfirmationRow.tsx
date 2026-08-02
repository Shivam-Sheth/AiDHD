import type { Booking } from "@/lib/mock/types";

export function BookedConfirmationRow({ booking }: { booking: Booking }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5">
      <p className="text-sm font-semibold text-ink">{booking.provider}</p>
      <p className="font-mono text-xs font-semibold text-success uppercase">
        Confirmed · {booking.confirmation_id}
      </p>
    </div>
  );
}
