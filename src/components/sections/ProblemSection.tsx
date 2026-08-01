import { Section } from "@/components/ui/Section";
import { ChatChaosStack } from "./ChatChaosStack";

export function ProblemSection() {
  return (
    <Section
      id="problem"
      tone="paper"
      eyebrow="The problem"
      title="Group chat is where plans go to die."
      subtitle="Three budgets. Two vibes. Zero bookings. Someone always ends up doing the group's homework — comparing tabs, chasing replies, fronting the ticket money. AiDHD is the agent that finishes the job."
    >
      <div className="mt-16">
        <ChatChaosStack />
      </div>
    </Section>
  );
}
