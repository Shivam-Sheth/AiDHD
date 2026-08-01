"use client";

import { useParams, useRouter } from "next/navigation";
import { useEvents } from "@/lib/mock/EventContext";
import { useToast } from "@/components/flow/ToastProvider";
import { EventNotFound } from "@/components/flow/EventNotFound";
import { StatusInviteeCard } from "@/components/flow/steps/StatusInviteeCard";
import { StatusBudgetBar } from "@/components/flow/steps/StatusBudgetBar";

export default function StatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { getEvent, nudgeInvitee } = useEvents();
  const toast = useToast();
  const event = getEvent(slug);

  if (!event) return <EventNotFound />;

  const responded = event.invitees.filter((i) => i.status === "responded");
  const pending = event.invitees.filter((i) => i.status !== "responded");
  const total = responded.reduce((sum, i) => sum + (i.budget_cap ?? 0), 0);

  function handleNudge(name: string, id: string) {
    nudgeInvitee(slug, id);
    toast.push(`Nudged ${name} — they'll get a reminder.`);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-dark uppercase">
        {event.title}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
        {responded.length} of {event.invitees.length} are in.
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {event.invitees.map((inv) => (
          <StatusInviteeCard
            key={inv.id}
            invitee={inv}
            onNudge={() => handleNudge(inv.name, inv.id)}
          />
        ))}
      </div>

      <div className="mt-8">
        {responded.length > 0 ? (
          <StatusBudgetBar
            total={total}
            pendingNames={pending.map((p) => p.name)}
            onViewPackages={() => router.push(`/e/${slug}/packages`)}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-paper p-5 text-center text-sm text-muted">
            No responses yet — nudge someone to get the ball rolling.
          </p>
        )}
      </div>
    </div>
  );
}
