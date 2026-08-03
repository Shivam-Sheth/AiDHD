import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/site/LegalDoc";
import { PageShell } from "@/components/site/PageShell";
import { CONTACT_EMAIL } from "@/components/site/footer-links";

export const metadata: Metadata = {
  title: "Pact — Terms of Service",
  description:
    "The terms that govern group buys, group trips, and agent-executed bookings on Pact.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    heading: "Agreement to these terms",
    blocks: [
      "By creating a Pact account, joining a group, or replying to a Pact message on WhatsApp or iMessage, you agree to these terms. If you are agreeing on behalf of an organization, you confirm you are authorized to bind it.",
      "If you do not agree, do not use the service. You can stop at any time by leaving your groups and deleting your account.",
    ],
  },
  {
    id: "what-pact-is",
    heading: "What Pact is (and is not)",
    blocks: [
      "Pact is a planning and checkout concierge. It collects budgets and preferences from a group, uses an agent subnet to build costed plans, and — once the group approves — places orders and bookings with third-party merchants and travel providers on your behalf.",
      "Pact is not the seller. Merchants, ticketing platforms, airlines, hotels, and restaurants remain the seller or provider of record for anything you buy. Their terms, fare rules, and house policies govern the purchase itself; ours govern your use of Pact.",
      "Pact does not hold your funds. Payments are authorized and captured through Prava under the mandates you approve.",
    ],
  },
  {
    id: "eligibility",
    heading: "Eligibility and accounts",
    blocks: [
      "You must be at least 18 years old and legally able to enter into contracts to use Pact. Some inventory (bars, nightlife venues, certain events) carries its own age restrictions that the merchant enforces at the door.",
      "You are responsible for keeping your account credentials and your device secure, and for activity that happens under your account. Tell us promptly if you believe your account has been used without your permission.",
    ],
  },
  {
    id: "groups",
    heading: "Groups, drops, and voting",
    blocks: [
      "Anyone in a group can invite others via a share link. Everyone in a group can see the group's plans, the aggregate budget picture, and votes. Do not add people to a group who have not agreed to be there.",
      "A drop is a time-boxed group-buy window opened by a brand, usually with a discount tied to a combined spend threshold. Windows close on a timer:",
      {
        list: [
          "If the group crosses the threshold before the timer ends, the discount applies to qualifying orders in that window.",
          "If the group does not cross it, no discounted order is placed and nobody is charged the group price. You are free to check out at list price or start a new window.",
          "Brands set the discount, threshold, eligible products, and duration. Pact does not guarantee that a window will run for a given brand or repeat.",
        ],
      },
      "Plans are generated once per group from all collected responses and shown identically to every member. A plan becomes bookable only after the group's vote resolves and the required mandates are approved.",
    ],
  },
  {
    id: "mandates",
    heading: "Payment mandates and agent authority",
    blocks: [
      "Pact never charges an open-ended amount. Before booking, it requests a separate Prava mandate per cost category — for example flights, hotel, tickets, and dining are four distinct authorizations, each with its own spend cap.",
      "By approving a mandate you authorize Pact to spend up to that cap, in that category, for that plan. The agent cannot exceed a cap, move budget between categories, or reuse a mandate for a different plan.",
      {
        list: [
          "If one category fails at booking time (inventory sold out, price moved, provider error), only that category is affected — Pact re-requests a mandate for it and leaves the rest of the booking intact.",
          "Unused authorization is released rather than captured. You are charged for what was actually booked.",
          "You are responsible for the amounts you approve, including your share of a group plan you voted for.",
        ],
      },
      "Card details are handled by Prava. Pact does not receive or store your full card number.",
    ],
  },
  {
    id: "automation",
    heading: "Automated decisions and accuracy",
    blocks: [
      "Pact uses AI models to interpret chat messages, rank options, and write plan summaries. Prices, availability, travel times, and venue details come from third-party providers and can change between the moment a plan is built and the moment it is booked.",
      "Review a plan before you approve its mandates. Pact shows the numbers it will act on; approving them is your decision, and the confirmation you receive from the merchant or carrier is the authoritative record of what was purchased.",
    ],
  },
  {
    id: "messaging",
    heading: "Messaging channels and consent",
    blocks: [
      "Pact collects group input over web chat, WhatsApp, and iMessage/SMS. By giving us your number or replying to a Pact message, you consent to receive planning, voting, and booking-confirmation messages for the groups you are in.",
      "Message and data rates from your carrier may apply. Reply STOP to opt out of SMS from a Pact number; opting out means you will need to use web chat to take part in a group.",
      "WhatsApp business-messaging rules limit when we can message you outside an active conversation window. If a session lapses, you may need to send a message before Pact can reply.",
    ],
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    blocks: [
      "Do not use Pact to break the law, and do not:",
      {
        list: [
          "Buy on behalf of someone whose payment method you are not authorized to use.",
          "Resell tickets or inventory in violation of the merchant's terms.",
          "Add people to groups without their consent, or use group channels to harass anyone.",
          "Scrape, reverse-engineer, overload, or probe the service or its providers, or use it to build a competing dataset of merchant pricing.",
          "Submit someone else's passport or identity documents without their permission.",
        ],
      },
      "We may suspend or terminate access that violates these rules or puts our providers' accounts at risk.",
    ],
  },
  {
    id: "third-parties",
    heading: "Third-party services",
    blocks: [
      "Pact depends on external providers, including Prava (payments), Shopify merchants, Ticketmaster, Duffel (flights and stays), Senso (vendor trust), Linq, Twilio and Meta (messaging), ElevenLabs (voice), and Google (maps and models). Their outages, terms, and policy decisions affect what Pact can do.",
      "Links and inventory surfaced from these providers are not endorsements. Your purchase agreement is with them.",
    ],
  },
  {
    id: "availability",
    heading: "Availability and disclaimers",
    blocks: [
      "Pact is provided \"as is\" and \"as available.\" This is a hackathon prototype: features change without notice, data may be reset, and the service may be unavailable for periods of time.",
      "To the fullest extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that plans will be error-free, that prices quoted will hold, or that any booking will be honored by the provider.",
    ],
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    blocks: [
      "To the fullest extent permitted by law, Pact and its team are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, missed events, or ruined plans.",
      "Our total liability for any claim relating to the service is limited to the greater of (a) the fees Pact earned on the transaction giving rise to the claim, or (b) fifty US dollars. Claims about the goods or services themselves belong with the merchant or provider that sold them.",
    ],
  },
  {
    id: "termination",
    heading: "Changes and termination",
    blocks: [
      "We may change these terms; material changes will be reflected in the \"last updated\" date and, where practical, announced in-product. Continuing to use Pact after a change means you accept the updated terms.",
      "You may stop using Pact and request deletion of your account at any time. Bookings already placed are governed by the relevant merchant's or carrier's cancellation policy — see the Returns / Refund policy.",
    ],
  },
  {
    id: "contact",
    heading: "Governing law and contact",
    blocks: [
      "These terms are governed by the laws of the operator's principal place of business, without regard to conflict-of-law rules. The specific jurisdiction and dispute-resolution venue will be named here before Pact operates commercially.",
      `Questions, notices, and legal correspondence: ${CONTACT_EMAIL}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms of Service"
      lede="What you agree to when you plan, vote, and check out with Pact."
    >
      <LegalDoc
        updated="August 2, 2026"
        intro="These terms cover Pact's group buys, group nights out, and multi-day trips — including how the agent is allowed to spend money on your behalf."
        sections={SECTIONS}
      />
    </PageShell>
  );
}
