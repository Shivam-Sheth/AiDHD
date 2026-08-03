import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/site/LegalDoc";
import { PageShell } from "@/components/site/PageShell";
import { CONTACT_EMAIL } from "@/components/site/footer-links";

export const metadata: Metadata = {
  title: "Pact — Privacy Policy",
  description:
    "What Pact collects from group chats, how the agent uses it, who it is shared with, and how traveler documents are encrypted.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "collect",
    heading: "What we collect",
    blocks: [
      {
        list: [
          "Account details: name, email, and (if you link a messaging channel) your phone number.",
          "Group content: the messages you send in a Pact group or to a Pact number on WhatsApp/iMessage, plus the budgets, dates, origin city, and preferences extracted from them.",
          "Plan and transaction records: the packages generated for your group, your votes, the mandates you approved, and the confirmations returned by merchants and carriers.",
          "Traveler documents: passport and identity details, but only when a flight booking requires them, and only in the encrypted vault described below.",
          "Technical data: IP address, browser and device type, and error logs from the app and its API routes.",
        ],
      },
      "We do not collect your full card number. Card details are entered and held by Prava; Pact sees mandate identifiers, amounts, and status.",
    ],
  },
  {
    id: "use",
    heading: "How we use it",
    blocks: [
      {
        list: [
          "To reconcile a group's responses into costed plans, and to search merchants, events, flights, and stays that fit them.",
          "To execute the bookings you approve, and to send confirmations back to the group over the channel you used.",
          "To keep group state consistent across channels — a plan you voted on in WhatsApp is the same plan you see on the web.",
          "To operate the service: debugging, abuse prevention, and keeping our provider integrations healthy.",
        ],
      },
      "We do not sell your personal information, and we do not use your group chat content for advertising.",
    ],
  },
  {
    id: "ai",
    heading: "AI processing",
    blocks: [
      "Pact sends message content and extracted preferences to large-language-model providers (Google Gemini as primary, OpenAI as fallback) to interpret free-text replies, rank options, and write plan summaries. Numbers in a plan — prices, totals, caps — are computed by the application, not by the model.",
      "Only the content needed for the task is sent. Vault contents (passports and identity documents) are never sent to a model, and the agent that builds and books plans only ever receives a vault reference, never the underlying document.",
    ],
  },
  {
    id: "vault",
    heading: "The traveler vault",
    blocks: [
      "Passport and traveler details are encrypted with AES-GCM before storage and held separately from the rest of your account data. Decryption happens only at the moment a specific flight booking needs to submit passenger details to the carrier.",
      "Neither the planning agent nor the group can read your documents. Other members of your group never see them at all — they see only that your traveler details are on file.",
      "You can delete vault entries from your account page at any time.",
    ],
  },
  {
    id: "sharing",
    heading: "Who we share with",
    blocks: [
      "We share the minimum needed to complete what you asked for:",
      {
        list: [
          "Prava — payment mandates, amounts, and merchant references.",
          "Merchants and providers — Shopify brands, Ticketmaster, restaurants, Duffel for flights and stays: order details, and for travel, the passenger information the carrier requires.",
          "Messaging providers — Meta (WhatsApp), Twilio, and Linq: your phone number and message content, so the message can be delivered.",
          "Infrastructure and tooling — Supabase (storage), Vercel (hosting), Senso (vendor trust scoring), ElevenLabs (voice confirmations), Google (maps, weather, models).",
          "Your group — the members of a group see your first name, your stated budget and preferences, your votes, and the group's shared plans. They do not see your email, payment details, or vault contents.",
        ],
      },
      "We also disclose information where legally required, or to protect against fraud and abuse.",
    ],
  },
  {
    id: "retention",
    heading: "Retention",
    blocks: [
      {
        list: [
          "Group chat and plan data is kept while the group is active and for a period afterwards so confirmations and receipts stay retrievable.",
          "Booking and payment records are kept as long as needed for support, disputes, and any applicable tax or accounting obligation.",
          "Vault documents are kept until you delete them or your account is deleted.",
          "Technical logs are short-lived and rotate out.",
        ],
      },
      "As a hackathon prototype, Pact also holds working state in memory and in a periodically flushed snapshot; that state can be reset between deployments.",
    ],
  },
  {
    id: "rights",
    heading: "Your choices and rights",
    blocks: [
      "Depending on where you live (including under GDPR and the CCPA/CPRA), you may have the right to access, correct, export, or delete your personal information, to object to certain processing, and to not be discriminated against for exercising those rights.",
      {
        list: [
          "Access, export, or delete: email us and we will action it within 30 days.",
          "Messaging: reply STOP to opt out of SMS, or remove the channel from your account.",
          "Vault: delete stored documents yourself from your account page.",
          "Leaving a group stops new group content from being collected about you; messages already sent to the group remain visible to it.",
        ],
      },
    ],
  },
  {
    id: "cookies",
    heading: "Cookies and local storage",
    blocks: [
      "Pact uses cookies and browser local storage for session/auth, your theme preference, and your local group session. There are no advertising or cross-site tracking cookies. Blocking them will sign you out and reset your theme.",
    ],
  },
  {
    id: "transfers",
    heading: "International transfers and security",
    blocks: [
      "Our providers operate in multiple countries, so your data may be processed outside your own. We rely on our providers' standard contractual protections for those transfers.",
      "We use encryption in transit, encryption at rest for vault contents, and least-privilege access to provider credentials. No system is perfectly secure; report a suspected vulnerability to us and we will investigate.",
    ],
  },
  {
    id: "children",
    heading: "Children",
    blocks: [
      "Pact is not intended for anyone under 18 and we do not knowingly collect their information. If you believe a minor has given us data, contact us and we will delete it.",
    ],
  },
  {
    id: "contact",
    heading: "Changes and contact",
    blocks: [
      "Material changes to this policy will be reflected in the \"last updated\" date above and, where practical, announced in-product.",
      `Privacy questions, data requests, and security reports: ${CONTACT_EMAIL}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy Policy"
      lede="Pact reads group chats to build plans. Here's exactly what that means for your data, your documents, and your card."
    >
      <LegalDoc updated="August 2, 2026" sections={SECTIONS} />
    </PageShell>
  );
}
