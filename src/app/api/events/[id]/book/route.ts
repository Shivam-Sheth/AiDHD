import { NextResponse } from "next/server";
import {
  executeBookings,
  rerequestFailedMandate,
} from "@/lib/agent/book";
import { syncExpensesFromBookings } from "@/lib/splits";
import { getEvent, listBookings } from "@/lib/store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ bookings: listBookings(id) });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "book" | "rerequest_failed";
    fail_ticket?: boolean;
  };

  if (body.action === "rerequest_failed") {
    const mandate = await rerequestFailedMandate(id);
    return NextResponse.json({ mandate });
  }

  const results = await executeBookings(id, {
    failTicket: Boolean(body.fail_ticket),
  });
  syncExpensesFromBookings(id);
  return NextResponse.json({
    results,
    bookings: listBookings(id),
    event: getEvent(id),
  });
}
