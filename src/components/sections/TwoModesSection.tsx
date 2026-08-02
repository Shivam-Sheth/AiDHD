import { Section } from "@/components/ui/Section";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { PlaneScene } from "@/components/three/PlaneScene";
import { getModelSrc } from "@/lib/model-assets";
import { ModeCard } from "./ModeCard";

export function TwoModesSection() {
  const planeSrc = getModelSrc("plane");

  return (
    <Section
      id="modes"
      tone="canvas"
      eyebrow="Same product, two kinds of plans"
      title="Nights out and multi-day trips — one flow."
      subtitle="Collect → package → pay per category → book. AiDHD tells the difference from the first message."
    >
      <PlaneScene
        src={planeSrc}
        className="mt-14 h-64 w-full overflow-hidden rounded-xl border border-line bg-surface sm:h-80"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RevealOnScroll>
          <ModeCard
            mode="outing"
            eyebrow="Night out"
            title="Concert + dinner"
            blurb="Tickets, timing, and a pre-show table that fits everyone's budget. Live end-to-end today — Prava mandates for ticket and dining."
            fields={[
              { label: "Category", value: "Ticket · Dining" },
              { label: "Turnaround", value: "Minutes, not days" },
            ]}
            bullets={[
              "Ticket tier + venue",
              "Pre-show dinner reservation",
              "Separate spend caps per category",
            ]}
          />
        </RevealOnScroll>
        <RevealOnScroll delay={0.08}>
          <ModeCard
            mode="trip"
            eyebrow="Travel"
            title="Weekend / multi-day trip"
            blurb="Flights, hotel, a day-by-day itinerary, and at least one dinner — same reconciliation agent, same per-category mandates."
            fields={[
              { label: "Category", value: "Flight · Hotel · Dining" },
              { label: "Turnaround", value: "One reconcile pass" },
            ]}
            bullets={[
              "Flights + hotel stays",
              "Itinerary days that fit the group",
              "Re-mandate only the leg that fails",
            ]}
          />
        </RevealOnScroll>
      </div>
    </Section>
  );
}
