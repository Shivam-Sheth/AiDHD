import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { CONTACT_EMAIL } from "@/components/site/footer-links";

export const metadata: Metadata = {
  title: "Pact — Support",
  description:
    "Fixes for the common Pact failure modes, plus how to reach a human about a booking, refund, or privacy request.",
};

const QUICK_LINKS: {
  href: string;
  title: string;
  body: string;
  external?: boolean;
}[] = [
  {
    href: "/faq",
    title: "FAQ",
    body: "Drops, mandates, refunds, and privacy — answered short.",
  },
  {
    href: "/status",
    title: "Status",
    body: "Which integrations are live right now, straight from /api/health.",
  },
  {
    href: `mailto:${CONTACT_EMAIL}`,
    title: "Email us",
    body: "A booking that went wrong, or anything the pages above don't cover.",
    external: true,
  },
];

const FIXES: { symptom: string; cause: string; fix: string }[] = [
  {
    symptom: "Pact stopped replying on WhatsApp",
    cause:
      "WhatsApp only lets a business message you freely inside an active conversation window. If yours lapsed, outbound replies are blocked until you speak first.",
    fix: "Send any message to the Pact number — even a single word. The collector resumes at the exact step you left off, not from the beginning.",
  },
  {
    symptom: "My group's plans disappeared",
    cause:
      "Group state is snapshotted and rehydrated between deployments. Right after a redeploy, the first request to hit a cold instance can briefly show an empty group.",
    fix: "Reload once. If the plans are still missing after a minute, email us with the group name — the snapshot is recoverable.",
  },
  {
    symptom: "I never got the invite link",
    cause:
      "Invites go out over the channel the organizer linked — SMS, WhatsApp, or email. Carrier filtering catches some SMS invites.",
    fix: "Ask the organizer to re-share the link from the group's share menu. Any member can re-send it; the link works in a browser without an app.",
  },
  {
    symptom: "The plan shows fewer options than expected",
    cause:
      "Some categories legitimately come back empty — no events that night, no flights on that route for those dates, nothing inside the group's budget.",
    fix: "Widen the date range or the budget and re-run planning. If a whole category is empty across every plan, check the status page: that integration may be running on fixtures.",
  },
  {
    symptom: "A mandate was declined",
    cause:
      "The cap was below the final price, the card was declined by the issuer, or the mandate expired before the group finished voting.",
    fix: "Re-approve the mandate for that category only — the rest of the booking is untouched. Prices move; the new request shows the current number.",
  },
  {
    symptom: "Part of the booking confirmed, part didn't",
    cause:
      "That is the designed behavior: each cost category books independently, so a failure in one does not roll back the others.",
    fix: "Approve the re-requested mandate for the failed category. You are not charged for anything that did not book.",
  },
];

const CONTACT_ROUTES: { subject: string; label: string; body: string }[] = [
  {
    subject: "Booking issue",
    label: "A booking went wrong",
    body: "Include the group name and the confirmation number shown on the component.",
  },
  {
    subject: "Refund request",
    label: "Refund or cancellation",
    body: "We reply with what the provider's policy allows within 1–2 business days.",
  },
  {
    subject: "Privacy request",
    label: "Access, export, or delete my data",
    body: "Actioned within 30 days. Vault entries you can delete yourself from your account.",
  },
  {
    subject: "Security report",
    label: "Report a vulnerability",
    body: "Please include reproduction steps. We will not pursue good-faith reporters.",
  },
];

export default function SupportPage() {
  return (
    <PageShell
      eyebrow="Support"
      title="Help & support"
      lede="Most problems are one of six things. Start here, then email us if none of them match."
      width="wide"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const inner = (
            <>
              <p className="font-display text-lg font-semibold text-[var(--ink)]">
                {link.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                {link.body}
              </p>
            </>
          );
          const className =
            "block rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--coral)]";
          return link.external ? (
            <a key={link.title} href={link.href} className={className}>
              {inner}
            </a>
          ) : (
            <Link key={link.title} href={link.href} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Common issues
        </h2>
        <p className="mt-1 text-[var(--muted)]">
          These are the real failure modes we hit building Pact, and what
          actually resolves them.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {FIXES.map((item) => (
            <div
              key={item.symptom}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <p className="font-semibold text-[var(--ink)]">{item.symptom}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                <span className="font-medium text-[var(--ink)]">Why: </span>
                {item.cause}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                <span className="font-medium text-[var(--coral)]">Fix: </span>
                {item.fix}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold text-[var(--ink)]">
          Talk to a human
        </h2>
        <p className="mt-1 text-[var(--muted)]">
          Pact is a small team building for the Prava Agentic Commerce
          Hackathon — there is no 24/7 desk, but every email is read. Expect a
          reply within 1–2 business days.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CONTACT_ROUTES.map((route) => (
            <a
              key={route.subject}
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(route.subject)}`}
              className="group flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--coral)]"
            >
              <span className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                {route.label}
                <span
                  aria-hidden
                  className="text-[var(--coral)] opacity-0 transition-opacity group-hover:opacity-100"
                >
                  →
                </span>
              </span>
              <span className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                {route.body}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Before you email about money
        </h2>
        <p className="mt-2 leading-relaxed text-[var(--muted)]">
          Refund outcomes are set by whoever sold the item — the merchant,
          venue, airline, or hotel. The{" "}
          <Link
            href="/legal/refunds"
            className="font-medium text-[var(--coral)] underline underline-offset-2"
          >
            returns and refund policy
          </Link>{" "}
          spells out what each category allows, so you know what to expect
          before you write in. If Pact booked something outside what you
          approved, say so directly — that one is on us.
        </p>
      </section>
    </PageShell>
  );
}
