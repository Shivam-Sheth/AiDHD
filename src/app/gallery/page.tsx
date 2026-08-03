import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = {
  title: "Pact — Recent drops & group gallery",
  description:
    "Group-buy windows, nights out, and trips that Pact has planned and booked — what the group set out to do and what it cost.",
};

type Drop = {
  brand: string;
  category: string;
  window: string;
  people: number;
  /** Combined spend the brand required to unlock the discount. */
  threshold: number;
  reached: number;
  discount: string;
  unlocked: boolean;
  note: string;
};

const DROPS: Drop[] = [
  {
    brand: "Zara",
    category: "Apparel",
    window: "2 hours",
    people: 9,
    threshold: 1200,
    reached: 1465,
    discount: "20% off",
    unlocked: true,
    note: "Agent bundled two carts that were $80 short into one that cleared the threshold with room to spare.",
  },
  {
    brand: "Glossier",
    category: "Beauty",
    window: "90 minutes",
    people: 6,
    threshold: 600,
    reached: 640,
    discount: "15% + free shipping",
    unlocked: true,
    note: "Crossed with eleven minutes left after the agent surfaced a restock that three people were waiting on.",
  },
  {
    brand: "On Running",
    category: "Footwear",
    window: "3 hours",
    people: 12,
    threshold: 2000,
    reached: 2340,
    discount: "25% off",
    unlocked: true,
    note: "Largest group in the set. Sizes were reconciled in chat before anyone checked out.",
  },
  {
    brand: "Aesop",
    category: "Home & body",
    window: "2 hours",
    people: 5,
    threshold: 900,
    reached: 705,
    discount: "18% off",
    unlocked: false,
    note: "Missed the threshold. Nobody was charged the group price — carts stayed intact at list price.",
  },
];

type Plan = {
  title: string;
  mode: "Night out" | "Trip";
  place: string;
  people: number;
  perPerson: number;
  components: string[];
  detail: string;
};

const PLANS: Plan[] = [
  {
    title: "Friday, decided in 40 minutes",
    mode: "Night out",
    place: "Chicago",
    people: 6,
    perPerson: 118,
    components: ["Tickets", "Dining"],
    detail:
      "Budgets ranged from $80 to $200. The best-match package landed a show plus a 9pm table two blocks away, inside every stated cap.",
  },
  {
    title: "Miami, three days, four budgets",
    mode: "Trip",
    place: "Miami",
    people: 4,
    perPerson: 640,
    components: ["Flights", "Hotel", "Dining", "Activities"],
    detail:
      "Four separate mandates. The hotel booked first, a flight leg repriced mid-booking, and only that leg was re-approved.",
  },
  {
    title: "Birthday dinner, no group chat scrolling",
    mode: "Night out",
    place: "Brooklyn",
    people: 8,
    perPerson: 74,
    components: ["Dining"],
    detail:
      "Two vegetarians and one shellfish allergy came in over WhatsApp. Every proposed venue cleared all three constraints.",
  },
];

function money(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

function DropCard({ drop }: { drop: Drop }) {
  const pct = Math.min(100, Math.round((drop.reached / drop.threshold) * 100));
  return (
    <div className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-[var(--ink)]">
            {drop.brand}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {drop.category} · {drop.window} window · {drop.people} people
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            drop.unlocked
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : "bg-[var(--surface-2)] text-[var(--muted)]"
          }`}
        >
          {drop.unlocked ? drop.discount : "Not unlocked"}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-[var(--ink)]">
            {money(drop.reached)}
          </span>
          <span className="text-[var(--muted)]">
            of {money(drop.threshold)} threshold
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className={`h-full rounded-full ${
              drop.unlocked ? "bg-[var(--coral)]" : "bg-[var(--faint)]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        {drop.note}
      </p>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <PageShell
      eyebrow="Product"
      title="Recent drops & group gallery"
      lede="Group-buy windows that opened, plans that got booked, and the one that missed its threshold."
      width="wide"
    >
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">
            Sample gallery.
          </span>{" "}
          These are representative runs from Pact&apos;s demo and hackathon
          builds, not a live feed. Once brands are opening windows on your
          account, your group&apos;s own drops appear here.
        </p>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Recent drops
        </h2>
        <p className="mt-1 text-[var(--muted)]">
          A brand opens a window with a discount and a combined spend
          threshold. The group either crosses it before the timer, or nobody
          pays the group price.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {DROPS.map((drop) => (
            <DropCard key={drop.brand} drop={drop} />
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Group gallery
        </h2>
        <p className="mt-1 text-[var(--muted)]">
          Nights out and trips planned from a group chat and booked with one
          mandate per cost category.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.title}
              className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                  {plan.mode}
                </span>
                <span className="text-xs text-[var(--faint)]">{plan.place}</span>
              </div>
              <p className="font-display mt-3 text-lg font-semibold text-[var(--ink)]">
                {plan.title}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {plan.people} people · {money(plan.perPerson)} per person
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                {plan.detail}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-4">
                {plan.components.map((c) => (
                  <span
                    key={c}
                    className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--muted)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Your group is next.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
          Start a window, drop the link in the chat, and let the agent do the
          reconciling.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/groups/new"
            className="rounded-xl bg-[var(--coral)] px-6 py-3 font-semibold text-white shadow-lg shadow-[var(--coral-shadow)] transition hover:bg-[var(--coral-hover)]"
          >
            Start a group buy →
          </Link>
          <Link
            href="/#how-it-works"
            className="rounded-xl border border-[var(--line)] px-6 py-3 font-semibold text-[var(--ink)] transition-colors hover:border-[var(--coral)]"
          >
            See how it works
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
