import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";
import { StatusBoard } from "@/components/site/StatusBoard";

export const metadata: Metadata = {
  title: "Pact — Status",
  description:
    "Live status of every Pact integration: payments, inventory, messaging channels, agents, and voice.",
};

export default function StatusPage() {
  return (
    <PageShell
      eyebrow="Support"
      title="System status"
      lede="Read live from the same /api/health endpoint the app uses. Refreshes every 60 seconds."
      width="wide"
    >
      <StatusBoard />
    </PageShell>
  );
}
