import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { ParticleOrb } from "./ParticleOrb";

const FACTS = [
  ["2–3", "costed plans per event"],
  ["1", "spend limit per category"],
  ["0", "group-chat threads needed"],
] as const;

export function IntroSection() {
  return (
    <section
      id="intro"
      className="relative scroll-mt-16 overflow-hidden border-t border-line bg-canvas py-24 lg:py-32"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <RevealOnScroll>
          <h2 className="font-hero text-[clamp(2.25rem,5vw,4rem)] text-ink">Introducing AiDHD.</h2>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-muted">
            The concierge agent for group plans. Everyone answers privately, on their own phone, in
            their own time. AiDHD reconciles the budgets and the vibes into real, costed plans —
            then books them with a separate spend limit for every category.
          </p>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-8 border-t border-line pt-8">
            {FACTS.map(([value, label]) => (
              <div key={label}>
                <dt className="font-hero text-3xl text-ink">{value}</dt>
                <dd className="mt-2 text-sm leading-snug text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1} className="justify-self-center">
          <ParticleOrb className="h-[min(60vw,26rem)] w-[min(60vw,26rem)]" />
        </RevealOnScroll>
      </div>
    </section>
  );
}
