import { NextResponse } from "next/server";
import { addGroupMessage } from "@/lib/social-store";
import { addSettlement } from "@/lib/social-store";
import {
  createManualExpense,
  getSplitSummary,
  syncExpensesFromBookings,
} from "@/lib/splits";
import { getEvent } from "@/lib/store";
import { getUserById } from "@/lib/social-store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  syncExpensesFromBookings(id);
  const summary = getSplitSummary(id);
  return NextResponse.json({
    ...summary,
    members: (summary?.member_ids ?? []).map((uid) => getUserById(uid)),
  });
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

  const body = (await req.json().catch(() => ({}))) as {
    action?: "add_expense" | "settle" | "sync";
    description?: string;
    amount?: number;
    paid_by?: string;
    split_user_ids?: string[];
    currency?: string;
    category?: string;
    from_user_id?: string;
    to_user_id?: string;
    note?: string;
  };

  const action = body.action ?? "add_expense";

  try {
    if (action === "sync") {
      syncExpensesFromBookings(id);
    } else if (action === "settle") {
      if (!body.from_user_id || !body.to_user_id || !(body.amount && body.amount > 0)) {
        return NextResponse.json(
          { error: "from_user_id, to_user_id, amount required" },
          { status: 400 },
        );
      }
      const settlement = addSettlement({
        event_id: id,
        from_user_id: body.from_user_id,
        to_user_id: body.to_user_id,
        amount: Math.round(body.amount * 100) / 100,
        currency: body.currency ?? "USD",
        note: body.note,
      });
      const from = getUserById(body.from_user_id)?.name ?? body.from_user_id;
      const to = getUserById(body.to_user_id)?.name ?? body.to_user_id;
      addGroupMessage({
        event_id: id,
        user_id: body.from_user_id,
        content: `${from} paid ${to} $${settlement.amount.toFixed(2)}${
          body.note ? ` — ${body.note}` : ""
        }`,
        kind: "expense",
        meta: { settlement_id: settlement.id },
      });
    } else {
      if (!body.paid_by || !(body.amount && body.amount > 0)) {
        return NextResponse.json(
          { error: "paid_by and amount required" },
          { status: 400 },
        );
      }
      const expense = createManualExpense({
        event_id: id,
        description: body.description ?? "Expense",
        amount: body.amount,
        paid_by: body.paid_by,
        split_user_ids: body.split_user_ids,
        currency: body.currency,
        category: body.category,
      });
      const payer = getUserById(body.paid_by)?.name ?? body.paid_by;
      addGroupMessage({
        event_id: id,
        user_id: body.paid_by,
        content: `${payer} added $${expense.amount.toFixed(2)} — ${expense.description}`,
        kind: "expense",
        meta: { expense_id: expense.id },
      });
    }

    const summary = getSplitSummary(id);
    return NextResponse.json({
      ...summary,
      members: (summary?.member_ids ?? []).map((uid) => getUserById(uid)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Split update failed" },
      { status: 400 },
    );
  }
}
