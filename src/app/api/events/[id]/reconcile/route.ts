import { NextResponse } from "next/server";
import { reconcileAndGeneratePackages } from "@/lib/agent/reconcile";
import {
  getEvent,
  listResponses,
  setPackages,
  upsertEvent,
} from "@/lib/store";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const responses = listResponses(id);
  if (responses.length === 0) {
    return NextResponse.json(
      { error: "No responses yet — seed demo or collect via chat first" },
      { status: 400 },
    );
  }

  upsertEvent({ ...event, status: "reconciling" });
  const result = await reconcileAndGeneratePackages(event, responses);
  setPackages(id, result.packages);
  upsertEvent({ ...getEvent(id)!, status: "voting" });

  return NextResponse.json({
    envelope: result.envelope,
    conflicts: result.conflicts,
    packages: result.packages,
  });
}
