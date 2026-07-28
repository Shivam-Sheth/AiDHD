import type { Response } from "../types";

export type BudgetConsensus = {
  average: number;
  median: number;
  target: number;
  /** Below target enough that packages may not fit them fairly */
  lowOutlierUserIds: string[];
  aligned: boolean;
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Group budget middle-ground. Low outliers get asked to raise toward the average.
 */
export function analyzeBudgetConsensus(responses: Response[]): BudgetConsensus {
  const caps = responses.map((r) => r.budget_cap).filter((n) => n > 0);
  if (!caps.length) {
    return {
      average: 0,
      median: 0,
      target: 0,
      lowOutlierUserIds: [],
      aligned: true,
    };
  }

  const average = Math.round(caps.reduce((a, b) => a + b, 0) / caps.length);
  const med = median(caps);
  // Ask people to meet the gentler of mean/median so we don't over-push
  const target = Math.round((average + med) / 2);

  const lowOutlierUserIds: string[] = [];
  for (const r of responses) {
    // Materially below target: <75% of target OR $40+ under
    if (r.budget_cap < target * 0.75 || target - r.budget_cap >= 40) {
      lowOutlierUserIds.push(r.user_id);
    }
  }

  return {
    average,
    median: med,
    target,
    lowOutlierUserIds,
    aligned: lowOutlierUserIds.length === 0,
  };
}
