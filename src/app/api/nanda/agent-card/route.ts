import { NextResponse } from "next/server";
import { getAgentCard } from "@/lib/integrations/nanda";

export async function GET() {
  return NextResponse.json(getAgentCard());
}
