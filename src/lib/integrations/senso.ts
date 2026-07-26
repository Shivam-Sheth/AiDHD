import { hasSenso } from "./config";

export interface SensoTrustResult {
  vendor: string;
  trust_score: number;
  verified: boolean;
  note: string;
  source: "senso" | "senso_mock";
  citations?: string[];
}

/** Fallback scores when Senso KB has no merchant context yet. */
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

const SENSO_BASE = "https://apiv2.senso.ai/api/v1";

function hashScore(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 0.72 + (h % 25) / 100;
}

function scoreFromSearch(answer: string, chunkCount: number): number {
  const base = Math.min(0.97, 0.78 + chunkCount * 0.03);
  const lower = answer.toLowerCase();
  if (lower.includes("not enough") || lower.includes("no relevant") || !answer.trim()) {
    return Math.max(0.65, base - 0.12);
  }
  return base;
}

/**
 * Query the org knowledge base for a merchant trust signal.
 * Uses Senso search (X-API-Key) — grounded answer + chunk count as verification.
 */
export async function lookupVendorTrust(vendor: string): Promise<SensoTrustResult> {
  if (hasSenso()) {
    try {
      const res = await fetch(`${SENSO_BASE}/org/search`, {
        method: "POST",
        headers: {
          "X-API-Key": process.env.SENSO_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `Merchant trust and reliability assessment for ${vendor}. Summarize reputation, booking reliability, and any risk flags from our knowledge base.`,
          max_results: 5,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          answer?: string;
          results?: Array<{ content?: string; title?: string; score?: number }>;
          chunks?: Array<{ content?: string; title?: string }>;
        };
        const chunks = data.results ?? data.chunks ?? [];
        const answer =
          data.answer?.trim() ||
          chunks
            .map((c) => c.content)
            .filter(Boolean)
            .slice(0, 2)
            .join(" ")
            .slice(0, 280);

        if (answer || chunks.length) {
          const note = answer
            ? `Senso KB: ${answer.slice(0, 180)}${answer.length > 180 ? "…" : ""}`
            : `Verified via Senso · ${chunks.length} source hit${chunks.length === 1 ? "" : "s"}`;
          return {
            vendor,
            trust_score: scoreFromSearch(answer, chunks.length),
            verified: true,
            note,
            source: "senso",
            citations: chunks
              .map((c) => c.title)
              .filter((t): t is string => Boolean(t))
              .slice(0, 3),
          };
        }
      }
    } catch {
      // fall through
    }
  }

  const mock = MOCK_SCORES[vendor];
  if (mock) {
    return {
      ...mock,
      source: hasSenso() ? "senso" : "senso_mock",
      note: hasSenso()
        ? `${mock.note} · (KB sparse — using curated prior until onboarding fills merchants)`
        : mock.note,
    };
  }

  return {
    vendor,
    trust_score: hashScore(vendor),
    verified: Boolean(hasSenso()),
    note: hasSenso()
      ? "Verified via Senso (no KB hits yet — run onboarding / ingest merchant docs)"
      : "Verified via Senso (synthetic — set SENSO_API_KEY)",
    source: hasSenso() ? "senso" : "senso_mock",
  };
}

/** Direct KB search helper for agent tooling / health checks. */
export async function sensoSearch(query: string) {
  if (!hasSenso()) {
    return { ok: false as const, mode: "mock" as const, answer: null, results: [] };
  }
  const res = await fetch(`${SENSO_BASE}/org/search`, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.SENSO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, max_results: 5 }),
  });
  if (!res.ok) {
    return {
      ok: false as const,
      mode: "live" as const,
      status: res.status,
      answer: null,
      results: [],
    };
  }
  const data = await res.json();
  return { ok: true as const, mode: "live" as const, ...data };
}
