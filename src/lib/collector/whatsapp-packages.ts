import { reconcileAndGeneratePackages } from "../agent/reconcile";
import { analyzeBudgetConsensus } from "../agent/budget-consensus";
import {
  analyzeDateConsensus,
  planDatesLabel,
} from "../agent/plan-dates";
import { hasDuffel, hasTicketmaster } from "../integrations/config";
import {
  getEvent,
  listResponses,
  setPackages,
  upsertEvent,
} from "../store";
import type { Package, Response } from "../types";

function sourceLine(eventType: string): string {
  if (eventType === "trip") {
    return hasDuffel()
      ? "Sources: Duffel flights + Duffel Stays (hotels)"
      : "Sources: Duffel fixtures (no DUFFEL_API_KEY)";
  }
  return hasTicketmaster()
    ? "Sources: Ticketmaster + dining"
    : "Sources: Ticketmaster fixtures (no TICKETMASTER_API_KEY)";
}

function formatComponent(c: Package["components"][number]): string {
  const icon =
    c.type === "ticket"
      ? "🎟"
      : c.type === "flight"
        ? "✈️"
        : c.type === "hotel"
          ? "🏨"
          : c.type === "dining"
            ? "🍽"
            : "🗓";
  return `${icon} ${c.details} — $${Math.round(c.cost)}`;
}

export function formatPackagesForWhatsApp(input: {
  eventTitle: string;
  eventType: string;
  packages: Package[];
  conflicts: string[];
  envelope: number;
  datesLabel: string;
  responseCount: number;
  budgetTarget?: number;
}): string {
  const lines: string[] = [
    input.eventType === "trip"
      ? `Group trip packages`
      : `Group outing packages`,
    `Same options for everyone (${input.responseCount} prefs weighed equally)`,
    `Consensus dates: ${input.datesLabel}`,
    `Group envelope ~$${input.envelope}` +
      (input.budgetTarget ? ` · target ~$${input.budgetTarget}/person` : ""),
    sourceLine(input.eventType),
  ];
  if (input.conflicts[0]) lines.push(`Note: ${input.conflicts[0]}`);
  lines.push("");

  for (const [i, pkg] of input.packages.slice(0, 3).entries()) {
    lines.push(
      `${i + 1}) ${pkg.label} — $${Math.round(pkg.total_cost)} total (~$${Math.round(pkg.cost_per_person)}/pp)`,
    );
    lines.push(`   📅 ${input.datesLabel}`);
    for (const c of pkg.components) {
      if (c.type === "itinerary_day") continue;
      lines.push(`   ${formatComponent(c)}`);
    }
    const itin = pkg.components.filter((c) => c.type === "itinerary_day");
    if (itin.length) {
      lines.push(`   🗓 ${itin.length} itinerary days included`);
    }
    if (pkg.rationale) lines.push(`   ${pkg.rationale.slice(0, 140)}`);
    lines.push("");
  }

  lines.push("Reply VOTE 1 / VOTE 2 / VOTE 3, or PACKAGES to refresh.");
  return lines.join("\n").trim();
}

export type PackageLookupResult = {
  ok: boolean;
  message: string;
  packages: Package[];
  outlierUserIds: string[];
  budgetOutlierUserIds: string[];
  budgetTarget: number;
  majorityLabel: string;
  responses: Response[];
};

function emptyResult(
  partial: Partial<PackageLookupResult> & { message: string },
): PackageLookupResult {
  return {
    ok: false,
    packages: [],
    outlierUserIds: [],
    budgetOutlierUserIds: [],
    budgetTarget: 0,
    majorityLabel: "",
    responses: [],
    ...partial,
  };
}

/** Run agents once for the whole group — identical packages for every member. */
export async function lookupPackagesForWhatsApp(
  eventId: string,
): Promise<PackageLookupResult> {
  const event = getEvent(eventId);
  if (!event) {
    return emptyResult({ message: "Event not found." });
  }

  const responses = listResponses(eventId);
  if (responses.length === 0) {
    return emptyResult({
      message:
        "Need at least one set of prefs first.\nBudget → dates → vibe → YES, then PACKAGES.",
    });
  }

  const dateConsensus = analyzeDateConsensus(responses);
  const budgetConsensus = analyzeBudgetConsensus(responses);
  const datesLabel =
    dateConsensus.majorityLabel ||
    planDatesLabel(responses, event.proposed_dates);

  const normalized = responses.map((r) =>
    dateConsensus.majorityDates.length
      ? {
          ...r,
          availability:
            dateConsensus.majorityDates.length >= 2
              ? [
                  dateConsensus.majorityDates[0],
                  dateConsensus.majorityDates[
                    dateConsensus.majorityDates.length - 1
                  ],
                ]
              : dateConsensus.majorityDates,
        }
      : r,
  );

  upsertEvent({ ...event, status: "reconciling" });
  try {
    const result = await reconcileAndGeneratePackages(event, normalized);
    setPackages(eventId, result.packages);
    upsertEvent({ ...getEvent(eventId)!, status: "voting" });

    let message = formatPackagesForWhatsApp({
      eventTitle: event.title,
      eventType: event.type,
      packages: result.packages,
      conflicts: result.conflicts,
      envelope: result.envelope,
      datesLabel,
      responseCount: responses.length,
      budgetTarget: budgetConsensus.target || undefined,
    });

    const notes: string[] = [];
    if (dateConsensus.outlierUserIds.length) {
      notes.push(
        `Most of the group is free ${datesLabel} — packages use that window. Date outliers get a ping.`,
      );
    }
    if (budgetConsensus.lowOutlierUserIds.length) {
      notes.push(
        `Group budget middle-ground ~$${budgetConsensus.target}/person — people under that get asked to RAISE.`,
      );
    }
    if (notes.length) {
      message = `${notes.join("\n")}\n\n${message}`;
    }

    return {
      ok: true,
      message,
      packages: result.packages,
      outlierUserIds: dateConsensus.outlierUserIds,
      budgetOutlierUserIds: budgetConsensus.lowOutlierUserIds,
      budgetTarget: budgetConsensus.target,
      majorityLabel: datesLabel,
      responses,
    };
  } catch (err) {
    upsertEvent({ ...getEvent(eventId)!, status: "collecting" });
    return emptyResult({
      message: `Lookup failed: ${err instanceof Error ? err.message : "unknown"}`,
      majorityLabel: datesLabel,
      responses,
      budgetTarget: budgetConsensus.target,
    });
  }
}
