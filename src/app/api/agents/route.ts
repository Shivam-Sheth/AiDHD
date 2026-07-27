import { NextResponse } from "next/server";
import { getAgentCard } from "@/lib/integrations/nanda";

/** Multi-agent subnet card for hackathon judges. */
export async function GET() {
  const card = getAgentCard();
  return NextResponse.json({
    orchestrator: "aidhd-orchestrator",
    model: "multi-agent subnet",
    collectors: ["whatsapp", "web", "imessage(linq)"],
    agents: [
      {
        id: "collector",
        role: "Channel-facing only — budgets, dates, prefs. No booking.",
      },
      { id: "tickets", role: "Ticketmaster Discovery search" },
      { id: "dining", role: "Dining search (Linq/fixtures)" },
      { id: "flights", role: "Flight search (Duffel when keyed)" },
      { id: "hotels", role: "Hotel search (Amadeus when keyed)" },
      { id: "itinerary", role: "Day-by-day trip plan" },
      { id: "trust", role: "Senso vendor trust" },
      { id: "payments", role: "Per-category Prava mandates" },
      {
        id: "voice",
        role: "Jarvis confirm — ElevenLabs TTS + optional Twilio call",
      },
    ],
    nanda: card,
  });
}
