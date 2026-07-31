import type { Metadata } from "next";
import { ConciergeAgent } from "@/components/ConciergeAgent";

export const metadata: Metadata = {
  title: "AiDHD — Live Concierge",
  description:
    "Real-time ElevenLabs agent that looks up flights, hotels, tickets and pays with Prava.",
};

export default function AgentPage() {
  return <ConciergeAgent />;
}
