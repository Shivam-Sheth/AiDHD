import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { CONTACT_EMAIL } from "@/components/site/footer-links";

export const metadata: Metadata = {
  title: "Pact — FAQ",
  description:
    "Common questions about group buys, drop windows, Prava mandates, group trips, and what Pact does with your data.",
};

type Faq = { q: string; a: string };

const GROUPS: { title: string; blurb: string; faqs: Faq[] }[] = [
  {
    title: "Basics",
    blurb: "What Pact is and how a group gets from chat to a plan.",
    faqs: [
      {
        q: "What is Pact?",
        a: "A group-planning concierge. One person starts a group buy, a night out, or a multi-day trip; everyone else drops their budget and preferences from wherever they already chat; an agent subnet turns that into 2–3 fully costed packages; the group votes; the agent books it end to end.",
      },
      {
        q: "What is a drop?",
        a: "A time-boxed group-buy window opened by a brand — a discount attached to a combined spend threshold, live for a couple of hours. Friends join the same window, the agent suggests bundles that close the gap to the threshold, and if the group crosses it before the timer ends, the discount applies to everyone's order.",
      },
      {
        q: "Do I need to install an app?",
        a: "No. You can take part entirely from WhatsApp or iMessage — the organizer drops a link in the chat and Pact asks you a handful of questions there. The web app gives you the richer view (map, package comparison, voting), but it is optional for participants.",
      },
      {
        q: "What is the difference between an outing and a trip?",
        a: "An outing is a single night: tickets and dining. A trip is multi-day: flights, hotel, dining, and activities. The mode is chosen when the group is created and stays fixed — it decides which agents run and which cost categories get their own mandate.",
      },
      {
        q: "How does voting work?",
        a: "Packages are built once per group from everyone's responses and shown identically to every member — usually a Budget, a Best-match, and a Splurge tier. Members vote on the one they want; the winning package is the only one that moves to mandates and booking.",
      },
      {
        q: "What happens if the window closes before we hit the threshold?",
        a: "Nothing is charged at the group price. Any authorization taken for the discounted order is released, your cart stays intact, and you can check out at list price or wait for the next window.",
      },
    ],
  },
  {
    title: "Payments and mandates",
    blurb: "How the agent is allowed to spend money on your behalf.",
    faqs: [
      {
        q: "What is a Prava mandate?",
        a: "A scoped payment authorization. Instead of one lump charge, Pact requests a separate mandate per cost category — flights, hotel, tickets, dining — each with its own spend cap tied to one specific plan.",
      },
      {
        q: "Can the agent spend more than I approved?",
        a: "No. A mandate caps the amount in its category, and the agent cannot exceed the cap, shift budget between categories, or reuse a mandate for a different plan. Unused authorization is released rather than captured.",
      },
      {
        q: "What happens if one part of the booking fails?",
        a: "Only that category is affected. If the hotel books but the flight sells out, the hotel stays booked and Pact re-requests a mandate for the flight leg with the new price. You are never charged for a category that did not book.",
      },
      {
        q: "Does Pact store my card?",
        a: "No. Card details are entered and held by Prava. Pact only ever sees mandate identifiers, amounts, and status.",
      },
      {
        q: "Who is actually selling me the thing?",
        a: "The merchant, venue, airline, or hotel. Pact places the order on your behalf, but they remain the seller of record — which is also why their policy governs refunds.",
      },
      {
        q: "How do refunds work?",
        a: "They follow whoever sold the item, and differ sharply by category: retail returns are usually straightforward, event tickets are usually final sale, and flights depend on the fare rules attached to the ticket you approved. The full breakdown is in the returns and refund policy.",
      },
    ],
  },
  {
    title: "Groups, privacy, and data",
    blurb: "What your group sees, what we store, and what you can delete.",
    faqs: [
      {
        q: "What can other people in my group see?",
        a: "Your first name, the budget and preferences you shared, your votes, and the group's shared plans. They do not see your email, your payment details, or anything in your traveler vault.",
      },
      {
        q: "Where do my passport details go?",
        a: "Into an encrypted vault, and only when a flight booking needs them. They are encrypted with AES-GCM, decrypted only at the moment the carrier needs passenger details, and never sent to an AI model. The planning agent only ever holds a reference to the vault entry.",
      },
      {
        q: "Does an AI read my messages?",
        a: "Yes — that is how free-text replies like \"I'm in for about $120, no seafood\" become structured budgets and constraints. Message content and extracted preferences go to Gemini (or OpenAI as fallback). Prices and totals in a plan are computed by the app, not written by the model.",
      },
      {
        q: "Can I stop the WhatsApp messages?",
        a: "Reply STOP to opt out of SMS from a Pact number, or remove the channel from your account page. You can still take part in a group from the web app.",
      },
      {
        q: "Why did Pact stop replying on WhatsApp?",
        a: "WhatsApp limits when a business can message you outside an active conversation window. If a session lapses, send any message to the Pact number and it will pick the conversation back up where it left off.",
      },
      {
        q: "Can I delete my data?",
        a: `Yes. Delete vault entries yourself from your account page, or email ${CONTACT_EMAIL} to request access, export, or full deletion — we action those within 30 days.`,
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <PageShell
      eyebrow="Support"
      title="Frequently asked questions"
      lede="Drops, mandates, group trips, and what happens to your data — the short answers."
    >
      <div className="space-y-14">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
              {group.title}
            </h2>
            <p className="mt-1 text-[var(--muted)]">{group.blurb}</p>

            {/* Native <details> — the accordion needs no client JS, and keyboard
                + find-in-page behavior comes free. */}
            <div className="mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {group.faqs.map((faq) => (
                <details key={faq.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]">
                    <span>{faq.q}</span>
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--faint)] transition-transform duration-200 group-open:rotate-45"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-[var(--muted)]">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Still stuck?
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          The{" "}
          <Link
            href="/support"
            className="font-medium text-[var(--coral)] underline underline-offset-2"
          >
            support page
          </Link>{" "}
          has fixes for the common failure modes, and{" "}
          <Link
            href="/status"
            className="font-medium text-[var(--coral)] underline underline-offset-2"
          >
            status
          </Link>{" "}
          shows which integrations are live right now. Otherwise, email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[var(--coral)] underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </PageShell>
  );
}
