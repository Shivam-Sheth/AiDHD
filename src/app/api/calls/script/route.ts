import { NextResponse } from "next/server";
import { generateCallScript } from "@/lib/agents/research-call";
import { resolveGroupUser } from "@/lib/groups/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * User-led calls: generate a ready-to-read phone script with the relevant
 * details so the user can dial a restaurant / hotel / airline / venue /
 * ticket provider / store / support line themselves.
 *
 * POST { venue_name, venue_type?, purpose, details? }
 */
export async function POST(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: {
    venue_name?: string;
    venue_type?: string;
    purpose?: string;
    details?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.venue_name || !body.purpose) {
    return NextResponse.json(
      { error: "venue_name and purpose required" },
      { status: 400 },
    );
  }

  const result = await generateCallScript({
    venue_name: body.venue_name,
    venue_type: body.venue_type,
    purpose: body.purpose,
    details: body.details,
    caller_name: user.name,
  });

  return NextResponse.json({ ok: true, ...result });
}
