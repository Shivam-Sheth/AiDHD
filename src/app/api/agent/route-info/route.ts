import { NextResponse } from "next/server";
import { getRouteInfo } from "@/lib/integrations/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hotel → hovered-place route info (drive/walk/bike/transit minutes + drive polyline). */
export async function POST(req: Request) {
  let body: {
    origin?: { lat?: number; lng?: number };
    destination?: { lat?: number; lng?: number };
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const origin = body.origin;
  const destination = body.destination;
  if (
    typeof origin?.lat !== "number" ||
    typeof origin?.lng !== "number" ||
    typeof destination?.lat !== "number" ||
    typeof destination?.lng !== "number"
  ) {
    return NextResponse.json(
      { error: "origin and destination {lat,lng} are required" },
      { status: 400 },
    );
  }

  const info = await getRouteInfo(
    { lat: origin.lat, lng: origin.lng },
    { lat: destination.lat, lng: destination.lng },
  );
  return NextResponse.json({ ok: true, ...info });
}
