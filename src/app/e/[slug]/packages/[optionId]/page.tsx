"use client";

import { useParams, useRouter } from "next/navigation";
import { useEvents } from "@/lib/mock/EventContext";
import { EventNotFound } from "@/components/flow/EventNotFound";
import { DetailLineItem } from "@/components/flow/steps/DetailLineItem";
import { DetailDayByDay } from "@/components/flow/steps/DetailDayByDay";
import { DetailCostSidebar } from "@/components/flow/steps/DetailCostSidebar";

export default function PackageDetailPage() {
  const { slug, optionId } = useParams<{ slug: string; optionId: string }>();
  const router = useRouter();
  const { getEvent, bookPackage } = useEvents();
  const event = getEvent(slug);

  if (!event) return <EventNotFound />;

  const pkg = event.packages.find((p) => p.id === optionId);
  if (!pkg) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        We don&apos;t have that package anymore — head back to Packages to pick again.
      </p>
    );
  }

  const lineItems = pkg.components.filter((c) => c.type !== "itinerary_day");
  const days = pkg.components.filter((c) => c.type === "itinerary_day");
  const combinedBudget = event.invitees.reduce((sum, i) => sum + (i.budget_cap ?? 0), 0);

  function handleBook() {
    bookPackage(slug, pkg!.id);
    router.push(`/e/${slug}/booked`);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-dark uppercase">
        {pkg.label}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{pkg.rationale}</h1>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          {lineItems.map((c, i) => (
            <DetailLineItem key={i} component={c} />
          ))}
          <DetailDayByDay days={days} />
        </div>
        <div className="w-full shrink-0 lg:w-72">
          <DetailCostSidebar
            total={pkg.total_cost}
            partySize={event.invitees.length}
            combinedBudget={combinedBudget}
            onBook={handleBook}
          />
        </div>
      </div>
    </div>
  );
}
