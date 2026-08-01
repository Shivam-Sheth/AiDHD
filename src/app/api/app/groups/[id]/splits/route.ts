import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import type { GroupExpense } from "@/lib/db/types";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function equalSplits(memberIds: string[], amount: number) {
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / memberIds.length);
  let rem = cents - base * memberIds.length;
  return memberIds.map((user_id) => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return { user_id, amount: (base + extra) / 100 };
  });
}

function summarize(
  memberIds: string[],
  expenses: GroupExpense[],
  settlements: { from_user_id: string; to_user_id: string; amount: number }[],
  nameOf: (id: string) => string,
) {
  const net = new Map<string, number>();
  for (const id of memberIds) net.set(id, 0);
  for (const e of expenses) {
    net.set(e.paid_by, round2((net.get(e.paid_by) ?? 0) + Number(e.amount)));
    for (const s of e.splits) {
      net.set(s.user_id, round2((net.get(s.user_id) ?? 0) - Number(s.amount)));
    }
  }
  for (const s of settlements) {
    net.set(s.from_user_id, round2((net.get(s.from_user_id) ?? 0) + s.amount));
    net.set(s.to_user_id, round2((net.get(s.to_user_id) ?? 0) - s.amount));
  }
  const balances = [...net.entries()].map(([user_id, value]) => ({
    user_id,
    name: nameOf(user_id),
    net: value,
  }));

  const debtors = balances.filter((b) => b.net < -0.009).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.net > 0.009).map((b) => ({ ...b }));
  debtors.sort((a, b) => a.net - b.net);
  creditors.sort((a, b) => b.net - a.net);
  const settles: {
    from_user_id: string;
    from_name: string;
    to_user_id: string;
    to_name: string;
    amount: number;
  }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = round2(Math.min(-d.net, c.net));
    if (amount > 0) {
      settles.push({
        from_user_id: d.user_id,
        from_name: d.name,
        to_user_id: c.user_id,
        to_name: c.name,
        amount,
      });
    }
    d.net = round2(d.net + amount);
    c.net = round2(c.net - amount);
    if (Math.abs(d.net) < 0.01) i += 1;
    if (Math.abs(c.net) < 0.01) j += 1;
  }

  return { balances, settles };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const { id } = await ctx.params;
  const db = auth.admin;
  if (!(await repo.assertMember(db, id, auth.user.id))) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const members = await repo.listMembers(db, id);
  const memberIds = members.map((m) => m.user_id);
  const expenses = await repo.listExpenses(db, id);
  const settlements = await repo.listSettlements(db, id);
  const nameOf = (uid: string) =>
    members.find((m) => m.user_id === uid)?.profile?.name || uid;
  const { balances, settles } = summarize(
    memberIds,
    expenses,
    settlements,
    nameOf,
  );

  return NextResponse.json({
    expenses,
    settlements,
    balances,
    settles,
    members,
    currency: expenses[0]?.currency || "USD",
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const { id } = await ctx.params;
  const db = auth.admin;
  if (!(await repo.assertMember(db, id, auth.user.id))) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "add_expense" | "settle";
    description?: string;
    amount?: number;
    paid_by?: string;
    from_user_id?: string;
    to_user_id?: string;
    note?: string;
    currency?: string;
  };

  const members = await repo.listMembers(db, id);
  const memberIds = members.map((m) => m.user_id);

  if (body.action === "settle") {
    if (!body.from_user_id || !body.to_user_id || !(body.amount && body.amount > 0)) {
      return NextResponse.json(
        { error: "from_user_id, to_user_id, amount required" },
        { status: 400 },
      );
    }
    const settlement = await repo.addSettlement(db, {
      group_id: id,
      from_user_id: body.from_user_id,
      to_user_id: body.to_user_id,
      amount: round2(body.amount),
      currency: body.currency || "USD",
      note: body.note || null,
    });
    await repo.addMessage(db, {
      group_id: id,
      user_id: auth.user.id,
      content: `Settlement: $${settlement.amount.toFixed(2)} recorded.`,
      kind: "expense",
      meta: { settlement_id: settlement.id },
    });
  } else {
    const amount = Number(body.amount);
    if (!(amount > 0)) {
      return NextResponse.json({ error: "amount required" }, { status: 400 });
    }
    const paid_by = body.paid_by || auth.user.id;
    if (!memberIds.includes(paid_by)) {
      return NextResponse.json({ error: "payer not in group" }, { status: 400 });
    }
    const expense = await repo.addExpense(db, {
      group_id: id,
      description: body.description?.trim() || "Shared cost",
      amount: round2(amount),
      currency: body.currency || "USD",
      paid_by,
      splits: equalSplits(memberIds, round2(amount)),
      category: null,
      source: "manual",
    });
    await repo.addMessage(db, {
      group_id: id,
      user_id: auth.user.id,
      content: `Added $${expense.amount.toFixed(2)} — ${expense.description}`,
      kind: "expense",
      meta: { expense_id: expense.id },
    });
  }

  const expenses = await repo.listExpenses(db, id);
  const settlements = await repo.listSettlements(db, id);
  const nameOf = (uid: string) =>
    members.find((m) => m.user_id === uid)?.profile?.name || uid;
  const { balances, settles } = summarize(
    memberIds,
    expenses,
    settlements,
    nameOf,
  );

  return NextResponse.json({
    expenses,
    settlements,
    balances,
    settles,
    members,
    currency: expenses[0]?.currency || "USD",
  });
}
