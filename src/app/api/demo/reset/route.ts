import { NextResponse } from "next/server";
import { resetStore, seedDemoEvent } from "@/lib/store";

export async function POST() {
  resetStore();
  const event = seedDemoEvent();
  return NextResponse.json({ ok: true, event });
}
