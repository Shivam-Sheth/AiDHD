import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/site/LegalDoc";
import { PageShell } from "@/components/site/PageShell";
import { CONTACT_EMAIL } from "@/components/site/footer-links";

export const metadata: Metadata = {
  title: "Pact — Returns & refund policy",
  description:
    "How returns, cancellations, and refunds work across group buys, tickets, dining, flights, and hotels booked through Pact.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "who-refunds",
    heading: "Who actually issues the refund",
    blocks: [
      "Pact books on your behalf, but the merchant, venue, airline, or hotel is the seller of record. Their return and cancellation policy is the one that decides whether a refund is possible and how much of it you get back.",
      "Pact's job in a refund is to identify the right provider, tell you what their policy allows, submit the cancellation where the provider supports it, and reverse the corresponding Prava mandate so nothing further is captured.",
    ],
  },
  {
    id: "by-category",
    heading: "What each category allows",
    blocks: [
      "Because Pact books per cost category, refunds work differently within the same plan:",
      {
        list: [
          "Retail / group-buy items (Shopify brands): standard merchant returns, typically 14–30 days for unworn, unused items in original packaging. Return shipping and restocking terms are the merchant's.",
          "Event tickets (Ticketmaster and similar): usually final sale. Refunds are generally only available if the event is cancelled, rescheduled beyond the provider's threshold, or moved. Some inventory is transferable or resellable even when it is not refundable.",
          "Dining reservations: free to cancel outside the venue's cancellation window; inside it, no-show and late-cancel fees set by the venue may apply.",
          "Flights (via Duffel): governed by the fare rules of the ticket you approved. Many economy fares are non-refundable, some allow changes for a fee, and refundable fares are refunded per the airline's timeline. Where a 24-hour cancellation right applies by law or airline policy, it is honored.",
          "Hotels and stays (via Duffel Stays): refundable rates can be cancelled up to the property's deadline; non-refundable and prepaid rates cannot be refunded once booked.",
        ],
      },
      "Before you approve a mandate, the plan shows the cancellation terms attached to that component. If a component is non-refundable, that is stated at approval time — not discovered afterward.",
    ],
  },
  {
    id: "group-buy",
    heading: "Group-buy discounts and threshold effects",
    blocks: [
      "In a drop, the discount is unlocked by the group's combined spend crossing a threshold. That creates two cases worth knowing about:",
      {
        list: [
          "The window closes without the threshold being met: no discounted order is placed and nobody is charged the group price. Any authorization taken for the discounted order is released.",
          "You return an item after the discount was applied: your refund is the amount you actually paid — the discounted price, not the list price. Returning an item does not retroactively cancel anyone else's discount.",
        ],
      },
      "Discount codes, promotional credit, and brand-funded incentives are not refunded as cash and are not reissued once a window has closed.",
    ],
  },
  {
    id: "how-to-request",
    heading: "How to request a refund",
    blocks: [
      "Start in the group where the booking was made — every confirmed component shows its provider, confirmation number, and cancellation terms. Use the cancel action where one is available, or email us with the group name and confirmation number.",
      {
        list: [
          `Email ${CONTACT_EMAIL} with the subject "Refund request" and include the confirmation number.`,
          "We acknowledge refund requests within 1–2 business days and tell you what the provider's policy allows.",
          "Where the provider supports API cancellation, we submit it the same day and confirm back in the group.",
        ],
      },
    ],
  },
  {
    id: "timing",
    heading: "Timing",
    blocks: [
      "Once a provider approves a refund, the funds move on their schedule, not ours. Typical windows are 5–10 business days for card refunds on retail, up to 7 business days for hotels, and up to 20 business days (sometimes a full billing cycle) for airline refunds.",
      "Released mandate authorizations — money that was authorized but never captured — usually disappear from your statement within 3–7 business days depending on your bank.",
    ],
  },
  {
    id: "not-refundable",
    heading: "What is not refundable",
    blocks: [
      {
        list: [
          "Services you received: a meal eaten, an event attended, a flight flown, a night stayed.",
          "No-shows, and cancellations made after the provider's deadline.",
          "Fare and rate types explicitly sold as non-refundable and approved as such.",
          "Missed events caused by things outside the provider's control — traffic, weather, or arriving after doors close.",
          "Changes of mind about a plan the group already voted for and booked, except where the provider's own policy allows a cancellation.",
        ],
      },
    ],
  },
  {
    id: "failures",
    heading: "When Pact gets it wrong",
    blocks: [
      "If Pact books something outside what you approved — the wrong date, the wrong category, an amount above the mandate cap, or a duplicate charge — that is on us. Report it and we will pursue the cancellation with the provider and refund any Pact-side fee on that transaction in full.",
      "If a booking fails partway through a plan, only the affected category is re-attempted. You are not charged for a category that never booked.",
    ],
  },
  {
    id: "chargebacks",
    heading: "Disputes and chargebacks",
    blocks: [
      "Please contact us before filing a chargeback — most issues resolve faster directly, and a chargeback can lock the booking in a disputed state that neither we nor the provider can then cancel or refund.",
      "For payment-level disputes, Prava's dispute process applies. We will provide the plan, mandate, and confirmation records needed to resolve it.",
    ],
  },
];

export default function RefundsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Returns & refund policy"
      lede="Refunds follow the merchant, venue, or carrier that sold the thing. Here's what that means per category — and what Pact does on your behalf."
    >
      <LegalDoc
        updated="August 2, 2026"
        sections={SECTIONS}
      />
    </PageShell>
  );
}
