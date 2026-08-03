"use client";

import { useParams, useRouter } from "next/navigation";
import { useEvents } from "@/lib/mock/EventContext";
import { EventNotFound } from "@/components/flow/EventNotFound";
import { PackagesCard } from "@/components/flow/steps/PackagesCard";

export default function PackagesPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { getEvent, setLastViewedPackage } = useEvents();
  const event = getEvent(slug);

  if (!event) return <EventNotFound />;

  const pending = event.invitees.filter((i) => i.status !== "responded");
  const mostVotedId = event.packages.reduce<string | null>((best, pkg) => {
    if (!best) return pkg.id;
    const bestPkg = event.packages.find((p) => p.id === best)!;
    return pkg.votes.length > bestPkg.votes.length ? pkg.id : best;
  }, null);

  function handleViewDetails(packageId: string) {
    setLastViewedPackage(slug, packageId);
    router.push(`/e/${slug}/packages/${packageId}`);
  }

  return (
    <div>
      <div className="text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink uppercase">
          {event.title}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">
          {pending.length === 0
            ? "Everyone's in. Here's what fits."
            : "Here's what fits so far."}
        </h1>
      </div>

      {event.packages.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-canvas p-6 text-center text-sm text-muted">
          No responses yet — packages will show up here as soon as someone answers.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <p className="mt-6 rounded-xl bg-line/40 px-4 py-2.5 text-center text-sm text-muted">
              Still waiting on {pending.map((p) => p.name).join(", ")} — packages will keep
              updating.
            </p>
          )}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {event.packages.map((pkg) => (
              <PackagesCard
                key={pkg.id}
                pkg={pkg}
                isMostVoted={pkg.id === mostVotedId}
                onViewDetails={() => handleViewDetails(pkg.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
