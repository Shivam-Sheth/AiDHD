import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  addMember,
  createInvite,
  getGroup,
  isMember,
  linkLinqChat,
} from "@/lib/groups/store";
import { hasLinq } from "@/lib/integrations/config";
import {
  createLinqChat,
  sendLinqChatMessage,
} from "@/lib/integrations/linq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invite phones over Linq iMessage.
 * Sandbox: first message must be link-free; invite URL goes in a follow-up.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const group = await getGroup(id);
  if (!group || !(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasLinq()) {
    return NextResponse.json(
      { error: "Linq not configured (LINQ_API_KEY + LINQ_PHONE_NUMBER)" },
      { status: 400 },
    );
  }

  let body: { phones?: string[]; names?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phones = (body.phones ?? [])
    .map((p) => String(p).trim())
    .filter(Boolean);
  if (!phones.length) {
    return NextResponse.json({ error: "phones required" }, { status: 400 });
  }

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i]!;
    await addMember({
      groupId: id,
      userId: `im_${phone.replace(/\D/g, "")}`,
      displayName: body.names?.[i] || phone,
      phone,
      channel: "imessage",
    });
  }

  const invite = await createInvite(id, user.id);
  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/invite/${invite.token}`;

  const opener = await createLinqChat({
    to: phones,
    text: `Hey — ${user.name} added you to "${group.title}" on AiDHD. Reply here and I'll drop the join link next.`,
  });

  if (!opener.ok || !opener.chat_id) {
    return NextResponse.json(
      {
        error:
          (opener as { error?: string }).error ||
          "Linq create chat failed (sandbox is inbound-first — ask them to text the Linq number first if this keeps failing).",
        detail: "data" in opener ? opener.data : undefined,
      },
      { status: 502 },
    );
  }

  await linkLinqChat(id, opener.chat_id);

  const follow = await sendLinqChatMessage({
    chat_id: opener.chat_id,
    text: `Join the party chat: ${inviteUrl}\nTag @AiDHD once you're in.`,
  });

  return NextResponse.json({
    ok: true,
    group_id: id,
    linq_chat_id: opener.chat_id,
    invite_url: inviteUrl,
    follow_up_ok: follow.ok,
    tip: "Linq sandbox: user may need to text your Linq number first. First outbound has no links; invite URL is the second message.",
  });
}
