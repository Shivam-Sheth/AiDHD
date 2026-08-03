import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  appendMessage,
  getGroup,
  isMember,
  supabaseConfigured,
} from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const BLOCKED_TYPES = /(x-msdownload|x-sh|x-executable)/i;

/**
 * Share a file into the group chat. Uploads go to the public
 * `chat-uploads` Supabase Storage bucket via the service role.
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
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "File sharing requires Supabase storage to be configured." },
      { status: 501 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "multipart form with a `file` field required" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (8 MB max)." }, { status: 413 });
  }
  if (BLOCKED_TYPES.test(file.type)) {
    return NextResponse.json({ error: "File type not allowed." }, { status: 415 });
  }

  const safeName = (file.name || "file")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
  const path = `${id}/${Date.now()}_${safeName}`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const upload = await fetch(
    `${base}/storage/v1/object/chat-uploads/${path}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: Buffer.from(await file.arrayBuffer()),
    },
  );
  if (!upload.ok) {
    const detail = await upload.text();
    return NextResponse.json(
      { error: `Upload failed (${upload.status}): ${detail.slice(0, 120)}` },
      { status: 502 },
    );
  }

  const publicUrl = `${base}/storage/v1/object/public/chat-uploads/${path}`;
  const message = await appendMessage({
    groupId: id,
    senderId: user.id,
    senderName: user.name,
    body: `Shared a file: ${file.name}\n${publicUrl}`,
    kind: "file",
    meta: {
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      file_url: publicUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    message: message ? { ...message, body_ciphertext: undefined } : null,
  });
}
