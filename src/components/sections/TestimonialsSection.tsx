import { Section } from "@/components/ui/Section";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { PostcardTestimonial } from "./PostcardTestimonial";

const TESTIMONIALS = [
  {
    quote: "I put in $150, got a plan, and never once opened Venmo to chase anyone.",
    name: "Devon R.",
    context: "organized a 9-person Brooklyn Steel night",
    stamp: "NYC",
    rotate: -2,
  },
  {
    quote: "Our flight leg failed on the first try. AiDHD re-asked for just that one — hotel and dinner stayed booked.",
    name: "Priya M.",
    context: "Miami weekend, 6 friends",
    stamp: "MIA",
    rotate: 1.5,
  },
  {
    quote: "Everyone answered on their own phone, in their own time. No 40-message thread required.",
    name: "Jordan K.",
    context: "planned a Friday dinner + show",
    stamp: "BKN",
    rotate: -1,
  },
];

export function TestimonialsSection() {
  return (
    <Section id="testimonials" tone="light" eyebrow="From the group chats we saved" title="Actually booked. Actually split.">
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <RevealOnScroll key={t.name} delay={i * 0.1}>
            <PostcardTestimonial {...t} />
          </RevealOnScroll>
        ))}
      </div>
    </Section>
  );
}
