import { NextResponse } from "next/server";
import {
  approveAllMandates,
  approveMandate,
  requestMandatesForPackage,
} from "@/lib/agent/book";
import { getEvent, listMandates } from "@/lib/store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ mandates: listMandates(id) });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    action: "request" | "approve" | "approve_all";
    package_id?: string;
    mandate_id?: string;
  };

  if (body.action === "request") {
    const packageId = body.package_id || event.selected_package_id;
    if (!packageId) {
      return NextResponse.json({ error: "package_id required" }, { status: 400 });
    }
    const mandates = await requestMandatesForPackage(id, packageId);
    return NextResponse.json({ mandates }, { status: 201 });
  }

  if (body.action === "approve" && body.mandate_id) {
    const mandate = await approveMandate(body.mandate_id);
    return NextResponse.json({ mandate });
  }

  if (body.action === "approve_all") {
    const mandates = await approveAllMandates(id);
    return NextResponse.json({ mandates });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
