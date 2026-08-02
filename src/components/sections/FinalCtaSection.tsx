import { Button } from "@/components/ui/Button";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

export function FinalCtaSection() {
  return (
    // Deliberately not an inverted band: `ink` is the *text* token, so a
    // bg-ink section flips to a glaring white slab in the dark theme.
    <section id="cta" className="border-t border-line bg-canvas py-28 lg:py-36">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-10">
        <RevealOnScroll>
          <p className="eyebrow">Ready when the group is</p>
          <h2 className="font-hero mt-5 text-[clamp(2.25rem,5vw,4rem)] text-ink">
            Stop planning by committee.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Start an outing or a trip, drop the link in the chat, and let AiDHD turn everyone&apos;s
            budgets into a plan worth booking.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button as="a" href="/login" size="lg">
              Join us
            </Button>
            <Button as="a" href="#demo" variant="secondary" size="lg">
              See the demo
            </Button>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
