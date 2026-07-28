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
      {
        id: "concierge",
        role: "ElevenAgents — talks to user (chat/call); can spawn research",
      },
      {
        id: "research",
        role: "Background outbound call to venues (height limits, policies…)",
      },
      {
        id: "hotel",
        role: "ElevenAgents Hotel Reservation template + Duffel Stays",
      },
      { id: "tickets", role: "Ticketmaster Discovery search" },
      { id: "dining", role: "Dining search (Linq/fixtures)" },
      { id: "flights", role: "Flight search (Duffel when keyed)" },
      { id: "hotels", role: "Hotel/stays search (Duffel Stays when keyed)" },
      { id: "itinerary", role: "Day-by-day trip plan" },
      { id: "trust", role: "Senso vendor trust" },
      { id: "payments", role: "Per-category Prava mandates" },
      {
        id: "voice",
        role: "Jarvis confirm — ElevenLabs TTS / ElevenAgents outbound",
      },
    ],
    dual_agent_demo: {
      endpoint: "POST /api/agents/research-call",
      whatsapp: "RESEARCH Venue | +1phone | question",
    },
    nanda: card,
  });
}
