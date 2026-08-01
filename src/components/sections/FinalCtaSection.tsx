import { HeroBackdrop } from "@/components/hero/HeroBackdrop";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

export function FinalCtaSection() {
  return (
    <section id="cta" className="relative overflow-hidden bg-dusk-950 py-24 text-dusk-ink lg:py-32">
      <HeroBackdrop variant="cta" />
      <div className="relative z-10 mx-auto max-w-2xl px-6 text-center lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Ready when the group is</p>
          <h2 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop planning by committee.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-dusk-muted">
            Start an outing or a trip, drop the link in the chat, and let AiDHD turn everyone&apos;s budgets
            into a plan worth booking.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#demo"
              className="rounded-full bg-gradient-to-r from-coral to-gold px-8 py-3.5 font-semibold text-dusk-950 shadow-warm transition hover:brightness-105"
            >
              Start planning
            </a>
            <a
              href="#top"
              className="rounded-full border border-white/25 px-8 py-3.5 font-semibold text-dusk-ink transition hover:border-white/50 hover:bg-white/5"
            >
              Back to top
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
