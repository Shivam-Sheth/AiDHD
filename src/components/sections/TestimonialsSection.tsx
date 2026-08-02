import { Section } from "@/components/ui/Section";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { Card } from "@/components/ui/Card";

const TESTIMONIALS = [
  {
    quote: "I put in $150, got a plan, and never once opened Venmo to chase anyone.",
    name: "Devon R.",
    context: "organized a 9-person Brooklyn Steel night",
  },
  {
    quote:
      "Our flight leg failed on the first try. AiDHD re-asked for just that one — hotel and dinner stayed booked.",
    name: "Priya M.",
    context: "Miami weekend, 6 friends",
  },
  {
    quote:
      "Everyone answered on their own phone, in their own time. No 40-message thread required.",
    name: "Jordan K.",
    context: "planned a Friday dinner + show",
  },
];

export function TestimonialsSection() {
  return (
    <Section
      id="testimonials"
      tone="surface"
      eyebrow="From the group chats we saved"
      title="Actually booked. Actually split."
    >
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <RevealOnScroll key={t.name} delay={i * 0.08}>
            <Card as="figure" className="flex h-full flex-col justify-between p-7">
              <blockquote className="text-base leading-relaxed text-ink">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-7 border-t border-line pt-5 text-sm">
                <span className="font-medium text-ink">{t.name}</span>
                <span className="mt-0.5 block text-muted">{t.context}</span>
              </figcaption>
            </Card>
          </RevealOnScroll>
        ))}
      </div>
    </Section>
  );
}
