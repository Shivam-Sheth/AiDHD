import clsx from "clsx";
import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const MESSAGES = [
  { text: "wait what's everyone's budget??", mine: false },
  { text: "can we do the 14th instead", mine: true },
  { text: "i said Friday not Sat", mine: false },
  { text: "who's fronting the tickets", mine: true },
  { text: "can we NOT do sushi again", mine: false },
  { text: "so… is this happening or not", mine: true },
];

const RESOLVED = [
  ["Date", "Fri, Mar 14"],
  ["Venue", "Brooklyn Steel · GA"],
  ["Dinner", "Llama Inn · 6:30pm"],
  ["Per person", "$150"],
];

export function ProblemSection() {
  return (
    <Section
      id="problem"
      tone="canvas"
      eyebrow="The problem"
      title="Group chat is where plans go to die."
      subtitle="Three budgets. Two vibes. Zero bookings. Someone always ends up doing the group's homework — comparing tabs, chasing replies, fronting the ticket money. AiDHD is the agent that finishes the job."
    >
      <div className="mt-14 grid items-start gap-6 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-4">Before</p>
          <Card className="space-y-2.5 p-5">
            {MESSAGES.map((m) => (
              <p
                key={m.text}
                className={clsx(
                  "w-max max-w-[85%] rounded-xl px-3.5 py-2 text-sm",
                  m.mine
                    ? "ml-auto bg-ink text-inverse"
                    : "border border-line bg-subtle text-ink",
                )}
              >
                {m.text}
              </p>
            ))}
            <p className="pt-2 text-center text-xs text-faint">42 messages. Still no booking.</p>
          </Card>
        </div>

        <div>
          <p className="eyebrow mb-4">After</p>
          <Card elevated>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="font-display text-base text-ink">Brooklyn Steel + dinner</p>
              <Badge tone="success">Booked</Badge>
            </div>
            <dl className="divide-y divide-line">
              {RESOLVED.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="text-sm font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-line px-5 py-3.5 text-xs text-faint">
              3 of 3 responded · reconciled in one pass
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
