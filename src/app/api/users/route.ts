import { NextResponse } from "next/server";
import {
  createUser,
  getUserById,
  listUsers,
} from "@/lib/social-store";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const user = getUserById(id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user });
  }
  return NextResponse.json({ users: listUsers() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    handle?: string;
    channel?: "web" | "whatsapp" | "imessage";
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const user = createUser({
    name: body.name,
    email: body.email,
    handle: body.handle,
    channel: body.channel,
  });
  return NextResponse.json({ user }, { status: 201 });
}
