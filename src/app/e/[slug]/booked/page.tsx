"use client";

import { useParams, useRouter } from "next/navigation";
import { useEvents } from "@/lib/mock/EventContext";
import { useToast } from "@/components/flow/ToastProvider";
import { EventNotFound } from "@/components/flow/EventNotFound";
import { BookedCheckmark } from "@/components/flow/steps/BookedCheckmark";
import { BookedConfirmationRow } from "@/components/flow/steps/BookedConfirmationRow";

export default function BookedPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { getEvent } = useEvents();
  const toast = useToast();
  const event = getEvent(slug);

  if (!event) return <EventNotFound />;

  if (event.bookings.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted">Nothing&apos;s booked yet.</p>
        <button
          type="button"
          onClick={() => router.push(`/e/${slug}/packages`)}
          className="mt-4 rounded-full border border-ink px-5 py-2.5 text-sm font-bold text-ink"
        >
          Back to packages
        </button>
      </div>
    );
  }

  const heading =
    event.type === "trip" ? "You're going. Pack accordingly." : "You're in. See you there.";

  return (
    <div className="mx-auto max-w-md text-center">
      <BookedCheckmark />
      <h1 className="mt-5 text-2xl font-bold text-ink sm:text-3xl">{heading}</h1>
      <p className="mt-2 text-sm text-muted">
        Every piece booked separately. Everyone already knows what they owe.
      </p>

      <div className="mt-6 space-y-2 text-left">
        {event.bookings.map((b) => (
          <BookedConfirmationRow key={b.id} booking={b} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => toast.push("Added to your calendar.")}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-surface"
        >
          Add to calendar
        </button>
        <button
          type="button"
          onClick={() => toast.push("Link copied — share it with the group.")}
          className="rounded-full border border-ink px-5 py-2.5 text-sm font-bold text-ink"
        >
          Share with group
        </button>
      </div>
    </div>
  );
}
