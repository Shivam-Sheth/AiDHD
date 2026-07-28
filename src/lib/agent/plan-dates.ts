import type { Response } from "../types";

function fmt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Expand [start,end] (or sparse days) into each calendar day ISO. */
export function expandDateRange(dates: string[]): string[] {
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  if (sorted.length === 0) return [];
  if (sorted.length === 1) return sorted;
  const start = new Date(`${sorted[0]}T12:00:00Z`);
  const end = new Date(`${sorted[sorted.length - 1]}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sorted;
  // Only expand if it looks like a start→end pair (≤ 21 days)
  const dayMs = 86400000;
  const span = Math.round((end.getTime() - start.getTime()) / dayMs);
  if (span < 0 || span > 21) return sorted;
  const out: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function formatDateRangeLabel(dates: string[]): string {
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  if (!sorted.length) return "dates TBD";
  if (sorted.length === 1) return fmt(sorted[0]);
  return `${fmt(sorted[0])} → ${fmt(sorted[sorted.length - 1])}`;
}

export type DateConsensus = {
  majorityDates: string[];
  majorityLabel: string;
  /** People whose availability barely overlaps the majority window */
  outlierUserIds: string[];
  /** Everyone overlaps enough */
  aligned: boolean;
};

/**
 * Prefer dates most people share. Outliers = respondents with little overlap
 * so we can ask them to make an exception or re-enter dates.
 */
export function analyzeDateConsensus(responses: Response[]): DateConsensus {
  const withDates = responses.filter((r) => r.availability?.length);
  if (!withDates.length) {
    return {
      majorityDates: [],
      majorityLabel: "dates TBD",
      outlierUserIds: [],
      aligned: true,
    };
  }

  const n = withDates.length;
  const counts = new Map<string, number>();
  const expandedByUser = new Map<string, string[]>();

  for (const r of withDates) {
    const days = expandDateRange(r.availability);
    expandedByUser.set(r.user_id, days);
    for (const d of days) counts.set(d, (counts.get(d) || 0) + 1);
  }

  // "Most people" = ceil(60%) or at least n-1 when small groups
  const threshold = n <= 2 ? n : Math.max(2, Math.ceil(n * 0.6));
  let majorityDates = [...counts.entries()]
    .filter(([, c]) => c >= threshold)
    .map(([d]) => d)
    .sort();

  // Fallback: densest day cluster by count
  if (!majorityDates.length) {
    const top = Math.max(...counts.values());
    majorityDates = [...counts.entries()]
      .filter(([, c]) => c === top)
      .map(([d]) => d)
      .sort();
  }

  const outlierUserIds: string[] = [];
  for (const r of withDates) {
    const days = expandedByUser.get(r.user_id) || [];
    const overlap = days.filter((d) => majorityDates.includes(d)).length;
    const need = Math.max(1, Math.ceil(majorityDates.length * 0.5));
    if (overlap < need) outlierUserIds.push(r.user_id);
  }

  return {
    majorityDates,
    majorityLabel: formatDateRangeLabel(majorityDates),
    outlierUserIds,
    aligned: outlierUserIds.length === 0,
  };
}

/** Human-readable plan dates from group responses (majority window). */
export function planDatesLabel(
  responses: Response[],
  fallbackDates: string[] = [],
): string {
  const consensus = analyzeDateConsensus(responses);
  if (consensus.majorityDates.length) return consensus.majorityLabel;
  if (fallbackDates.length) return formatDateRangeLabel(fallbackDates);
  return "dates TBD";
}
