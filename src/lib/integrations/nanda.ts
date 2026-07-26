/**
 * Project NANDA — AgentFacts registration artifact.
 * Smallest prize track; this JSON is a real, demoable registry entry.
 */
export const AIDHD_AGENT_FACTS = {
  "@context": "https://nanda.mit.edu/agentfacts/v1",
  id: "agent:aidhd:group-planning",
  name: "AiDHD Group Planning Agent",
  description:
    "Reconciles multi-person budgets and preferences into costed outing packages, then books end-to-end via per-category Prava mandates.",
  version: "0.1.0",
  provider: {
    name: "AiDHD",
    url: "https://github.com/Shivam-Sheth/AiDHD",
  },
  capabilities: [
    "collect_group_preferences",
    "reconcile_budgets",
    "generate_packages",
    "merchant_trust_lookup",
    "prava_mandate_orchestration",
    "ticket_and_dining_booking",
  ],
  endpoints: {
    a2a: "/api/nanda/a2a",
    card: "/api/nanda/agent-card",
  },
  protocols: ["A2A", "HTTP+JSON"],
  payment: {
    provider: "Prava",
    model: "per-category mandates",
    network: "Visa Intelligent Commerce / Trusted Agent Protocol",
  },
  discovery: {
    tags: [
      "agentic-commerce",
      "group-planning",
      "booking",
      "prava",
      "senso",
      "openai",
    ],
    hackathon: "Prava Agentic Commerce Hackathon 2026",
  },
} as const;

export function getAgentCard() {
  return {
    ...AIDHD_AGENT_FACTS,
    registered_at: "2026-07-26T00:00:00.000Z",
    status: "active",
  };
}

/** Stretch: minimal A2A handler for a sub-task from another NANDA agent. */
export async function handleA2A(task: {
  method: string;
  params?: Record<string, unknown>;
}) {
  if (task.method === "capabilities.list") {
    return { result: AIDHD_AGENT_FACTS.capabilities };
  }
  if (task.method === "trust.ping") {
    return {
      result: {
        ok: true,
        agent: AIDHD_AGENT_FACTS.id,
        message: "AiDHD planning agent online",
      },
    };
  }
  if (task.method === "package.summarize") {
    return {
      result: {
        message:
          "Send event_id to POST /api/events/:id/reconcile for full package generation.",
      },
    };
  }
  return { error: { code: -32601, message: `Unknown method: ${task.method}` } };
}
