import { NextResponse } from "next/server";
import { handleA2A } from "@/lib/integrations/nanda";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    method: string;
    params?: Record<string, unknown>;
  };
  const result = await handleA2A(body);
  return NextResponse.json(result);
}
