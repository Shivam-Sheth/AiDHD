import { Section } from "@/components/ui/Section";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

const STEPS = [
  {
    n: "01",
    title: "Start an event and invite the crew",
    description:
      "Pick an outing or a trip, add the dates. Web, WhatsApp, or iMessage — whatever the group already uses.",
  },
  {
    n: "02",
    title: "Everyone drops budget and vibes, on their own",
    description:
      "No group-chat back-and-forth. Each person answers privately, whenever they get to it.",
  },
  {
    n: "03",
    title: "The agent serves plans. You vote. It books.",
    description:
      "Real prices, real vendors, separate Prava spend limits per category — not one lump sum.",
  },
];

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      tone="surface"
      eyebrow="How it works"
      title="Three steps from chaos to a booked night — or a booked trip."
    >
      <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <RevealOnScroll key={s.n} delay={i * 0.08} className="bg-surface">
            <div className="h-full p-7">
              <p className="font-mono text-sm text-faint">{s.n}</p>
              <h3 className="font-display mt-5 text-lg text-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.description}</p>
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </Section>
  );
}
