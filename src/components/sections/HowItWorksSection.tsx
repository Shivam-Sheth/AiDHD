import { Section } from "@/components/ui/Section";
import { FlightPathSteps } from "./FlightPathSteps";

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      tone="light"
      eyebrow="How it works"
      title="Three steps from chaos to a booked night — or a booked trip."
    >
      <FlightPathSteps />
    </Section>
  );
}
