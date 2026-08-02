import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  createGroup,
  linkLinqChat,
  listGroupsForUser,
} from "@/lib/groups/store";
import type { GroupMode } from "@/lib/groups/types";
import { hasLinq } from "@/lib/integrations/config";
import { createLinqChat } from "@/lib/integrations/linq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const groups = await listGroupsForUser(user.id);
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: {
    title?: string;
    mode?: GroupMode;
    place?: string;
    proposed_dates?: string[];
    linq_phones?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const { group, invite } = await createGroup({
    title,
    mode: body.mode === "trip" ? "trip" : "outing",
    place: body.place,
    proposed_dates: body.proposed_dates,
    organizer: user,
  });

  // Optional: seed a Linq iMessage thread for the same party
  if (hasLinq() && body.linq_phones?.length) {
    try {
      const chat = await createLinqChat({
        to: body.linq_phones,
        text: `AiDHD party "${group.title}" is live. Tag me anytime — same group as the web invite.`,
      });
      if (chat.ok && chat.chat_id) {
        await linkLinqChat(group.id, chat.chat_id);
        group.linq_chat_id = chat.chat_id;
      }
    } catch {
      // non-fatal
    }
  }

  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      group,
      invite,
      invite_url: `${origin}/invite/${invite.token}`,
    },
    { status: 201 },
  );
}
