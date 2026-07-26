import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/integrations/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: "AiDHD",
    hackathon: "Prava Agentic Commerce Hackathon 2026",
    integrations: integrationStatus(),
  });
}
