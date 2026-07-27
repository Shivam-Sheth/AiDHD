/**
 * @deprecated Prefer `runPlanningSubnet` from `@/lib/agents/orchestrator`.
 * Kept as a thin adapter so existing `/api/events/:id/reconcile` keeps working.
 */
import { runPlanningSubnet } from "../agents/orchestrator";
import type { Event, Package, Response } from "../types";

export async function reconcileAndGeneratePackages(
  event: Event,
  responses: Response[],
): Promise<{ packages: Package[]; conflicts: string[]; envelope: number }> {
  return runPlanningSubnet(event, responses);
}
