import { NextResponse } from "next/server";
import { runVoiceConfirmation } from "@/lib/integrations/voice";
import { getEvent, getPackage, pushAgentLog } from "@/lib/store";
import { getUser } from "@/lib/demo-users";

/**
 * Voice agent — craft Jarvis-like script (+ ElevenLabs audio / Twilio call when keyed).
 * POST { event_id, package_id?, to_phone? }
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    event_id?: string;
    package_id?: string;
    to_phone?: string;
  };
  const eventId = body.event_id || "evt_demo_friday";
  const event = getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const pkgId = body.package_id || event.selected_package_id;
  const pkg = pkgId ? getPackage(pkgId) : undefined;
  const organizer = getUser(event.organizer_id);

  const voice = await runVoiceConfirmation({
    organizer_name: organizer?.name ?? "there",
    organizer_phone: body.to_phone || process.env.VOICE_CONFIRM_PHONE,
    event_title: event.title,
    package_label: pkg?.label ?? "your plan",
    total_cost: pkg?.total_cost ?? 0,
    categories: pkg
      ? [
          ...new Set(
            pkg.components
              .map((c) => c.type)
              .filter((t) => t !== "itinerary_day"),
          ),
        ]
      : ["ticket", "dining"],
  });

  pushAgentLog(
    eventId,
    "agent:voice",
    `${voice.mode} · ${voice.detail}`,
  );

  return NextResponse.json({ ok: true, voice });
}
