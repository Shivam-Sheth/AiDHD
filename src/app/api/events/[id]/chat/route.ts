import { NextResponse } from "next/server";
import {
  handleCollectorMessage,
  startCollector,
} from "@/lib/collector/web-chat";
import { getCollector, getEvent } from "@/lib/store";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const session = getCollector(id, userId) ?? startCollector(id, userId);
  return NextResponse.json({ session });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const body = (await req.json()) as { user_id: string; message: string };
  if (!body.user_id || !body.message) {
    return NextResponse.json(
      { error: "user_id and message required" },
      { status: 400 },
    );
  }
  const result = handleCollectorMessage(id, body.user_id, body.message);
  return NextResponse.json(result);
}
