/**
 * AiDHD multi-agent subnet (hackathon architecture)
 *
 * Channels (WhatsApp / web / Linq) = COLLECT ONLY → Response schema
 * Orchestrator fans work to specialist agents → packages → Prava → book → voice confirm
 */

export type AgentId =
  | "orchestrator"
  | "collector" // channel-facing only; not used for search/book
  | "tickets"
  | "dining"
  | "flights"
  | "hotels"
  | "itinerary"
  | "trust"
  | "payments"
  | "voice";

export interface AgentMessage {
  from: AgentId;
  to: AgentId | "broadcast";
  type: string;
  payload: unknown;
  at: string;
}

export interface AgentRunResult<T = unknown> {
  agent: AgentId;
  ok: boolean;
  detail: string;
  data?: T;
}
