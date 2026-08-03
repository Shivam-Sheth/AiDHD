import type { Metadata } from "next";
import { ConciergeAgent } from "@/components/ConciergeAgent";

export const metadata: Metadata = {
  title: "Pact — Live Concierge",
  description:
    "Real-time ElevenLabs agent that looks up flights, hotels, tickets and pays with Prava.",
};

export default function AgentPage() {
  return (
    <ConciergeAgent
      googleMapsApiKey={process.env.GOOGLE_MAPS_API || null}
      pravaPublishableKey={process.env.PRAVA_PUBLISHABLE_KEY || null}
    />
  );
}
