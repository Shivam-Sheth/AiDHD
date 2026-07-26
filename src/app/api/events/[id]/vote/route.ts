import { NextResponse } from "next/server";
import {
  getEvent,
  getPackage,
  listPackages,
  upsertEvent,
  upsertPackage,
} from "@/lib/store";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = (await req.json()) as { package_id: string; user_id: string };
  const pkg = getPackage(body.package_id);
  if (!pkg || pkg.event_id !== id) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Clear prior vote from this user across packages
  for (const p of listPackages(id)) {
    const votes = p.votes.filter((v) => v !== body.user_id);
    upsertPackage({ ...p, votes });
  }

  const fresh = getPackage(body.package_id)!;
  upsertPackage({ ...fresh, votes: [...fresh.votes, body.user_id] });

  const updated = listPackages(id);
  const winner = [...updated].sort((a, b) => b.votes.length - a.votes.length)[0];
  const totalVotes = updated.reduce((s, p) => s + p.votes.length, 0);

  if (totalVotes >= event.invitee_ids.length && winner) {
    upsertEvent({
      ...event,
      status: "paying",
      selected_package_id: winner.id,
    });
  }

  return NextResponse.json({ packages: listPackages(id), selected: getEvent(id)?.selected_package_id });
}
