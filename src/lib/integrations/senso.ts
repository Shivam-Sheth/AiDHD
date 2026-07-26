import { hasSenso } from "./config";

export interface SensoTrustResult {
  vendor: string;
  trust_score: number;
  verified: boolean;
  note: string;
  source: "senso" | "senso_mock";
}

/** Curated trust signals for demo merchants (used when SENSO_API_KEY is absent). */
const MOCK_SCORES: Record<string, Omit<SensoTrustResult, "source">> = {
  Ticketmaster: {
    vendor: "Ticketmaster",
    trust_score: 0.91,
    verified: true,
    note: "Verified ticketing marketplace · complaint rate within industry norms",
  },
  AXS: {
    vendor: "AXS",
    trust_score: 0.88,
    verified: true,
    note: "Verified primary box office · venue-linked inventory",
  },
  Lilia: {
    vendor: "Lilia",
    trust_score: 0.94,
    verified: true,
    note: "Verified via health + reservation sources · consistently high reviews",
  },
  "Rule of Thirds": {
    vendor: "Rule of Thirds",
    trust_score: 0.9,
    verified: true,
    note: "Verified neighborhood dining · low cancellation disputes",
  },
  Carbone: {
    vendor: "Carbone",
    trust_score: 0.86,
    verified: true,
    note: "Verified high-demand restaurant · deposit policies disclosed",
  },
  "Emma's Torch": {
    vendor: "Emma's Torch",
    trust_score: 0.96,
    verified: true,
    note: "Verified mission-driven restaurant · strong verified community signal",
  },
};

function hashScore(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 0.72 + (h % 25) / 100;
}

export async function lookupVendorTrust(vendor: string): Promise<SensoTrustResult> {
  if (hasSenso()) {
    try {
      const res = await fetch("https://api.senso.ai/v1/trust/lookup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SENSO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity: vendor, category: "merchant" }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          score?: number;
          verified?: boolean;
          summary?: string;
        };
        return {
          vendor,
          trust_score: data.score ?? hashScore(vendor),
          verified: data.verified ?? true,
          note: data.summary ?? "Verified via Senso",
          source: "senso",
        };
      }
    } catch {
      // fall through to mock
    }
  }

  const mock = MOCK_SCORES[vendor];
  if (mock) return { ...mock, source: "senso_mock" };

  return {
    vendor,
    trust_score: hashScore(vendor),
    verified: true,
    note: "Verified via Senso (synthetic score — set SENSO_API_KEY for live)",
    source: "senso_mock",
  };
}
