import { NextResponse } from "next/server";
import { scriptedLinqFlow } from "@/lib/integrations/linq";
import { ensureSeeded, listEvents } from "@/lib/store";

export async function GET() {
  ensureSeeded();
  const event = listEvents()[0];
  return NextResponse.json({
    channel: "imessage",
    provider: "Linq",
    mode: process.env.LINQ_API_KEY ? "live" : "mock",
    transcript: scriptedLinqFlow(event?.title ?? "Friday night out"),
  });
}
