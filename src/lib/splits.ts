import {
  addExpense,
  getUserById,
  listExpenses,
  listSettlements,
  upsertExpense,
} from "./social-store";
import type {
  BalanceRow,
  Expense,
  SplitSummary,
  TransferSuggestion,
} from "./social-types";
import {
  getEvent,
  getPackage,
  listBookings,
  listMandates,
} from "./store";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Equal split of `amount` across `memberIds`. Remainder cents go to first members. */
export function equalSplits(memberIds: string[], amount: number) {
  if (memberIds.length === 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / memberIds.length);
  let rem = cents - base * memberIds.length;
  return memberIds.map((user_id) => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return { user_id, amount: (base + extra) / 100 };
  });
}

export function computeBalances(
  memberIds: string[],
  expenses: Expense[],
  settlements: { from_user_id: string; to_user_id: string; amount: number }[],
): BalanceRow[] {
  const net = new Map<string, number>();
  for (const id of memberIds) net.set(id, 0);

  for (const e of expenses) {
    if (!net.has(e.paid_by)) net.set(e.paid_by, 0);
    net.set(e.paid_by, round2((net.get(e.paid_by) ?? 0) + e.amount));
    for (const s of e.splits) {
      if (!net.has(s.user_id)) net.set(s.user_id, 0);
      net.set(s.user_id, round2((net.get(s.user_id) ?? 0) - s.amount));
    }
  }

  for (const s of settlements) {
    if (!net.has(s.from_user_id)) net.set(s.from_user_id, 0);
    if (!net.has(s.to_user_id)) net.set(s.to_user_id, 0);
    // from paid to → from's debt decreases (net up), to's credit decreases (net down)
    net.set(s.from_user_id, round2((net.get(s.from_user_id) ?? 0) + s.amount));
    net.set(s.to_user_id, round2((net.get(s.to_user_id) ?? 0) - s.amount));
  }

  return [...net.entries()]
    .filter(([id]) => memberIds.includes(id))
    .map(([user_id, value]) => ({
      user_id,
      name: getUserById(user_id)?.name ?? user_id,
      net: value,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Greedy settle-up: debtors pay creditors. */
export function suggestSettlements(
  balances: BalanceRow[],
): TransferSuggestion[] {
  const debtors = balances
    .filter((b) => b.net < -0.009)
    .map((b) => ({ ...b, net: b.net }))
    .sort((a, b) => a.net - b.net);
  const creditors = balances
    .filter((b) => b.net > 0.009)
    .map((b) => ({ ...b, net: b.net }))
    .sort((a, b) => b.net - a.net);

  const out: TransferSuggestion[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = round2(Math.min(-d.net, c.net));
    if (amount > 0) {
      out.push({
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
  return out;
}

/**
 * Materialize Splitwise expenses from the selected package / confirmed bookings.
 * Idempotent via stable expense ids.
 */
export function syncExpensesFromBookings(eventId: string): Expense[] {
  const event = getEvent(eventId);
  if (!event?.selected_package_id) return listExpenses(eventId);

  const pkg = getPackage(event.selected_package_id);
  if (!pkg) return listExpenses(eventId);

  const members = event.invitee_ids;
  const organizer = event.organizer_id;
  const bookings = listBookings(eventId);
  const mandates = listMandates(eventId);
  const currency = pkg.components[0]?.currency ?? "USD";

  if (bookings.some((b) => b.status === "confirmed")) {
    for (const booking of bookings.filter((b) => b.status === "confirmed")) {
      const mandate = mandates.find((m) => m.id === booking.mandate_id);
      const component = pkg.components.find((c) => c.type === booking.category);
      const amount = mandate?.amount_cap ?? component?.cost ?? 0;
      if (amount <= 0) continue;
      const id = `exp_booking_${booking.id}`;
      upsertExpense({
        id,
        event_id: eventId,
        description: `${booking.category} · ${booking.provider}${
          booking.confirmation_id ? ` · ${booking.confirmation_id}` : ""
        }`,
        amount,
        currency: mandate?.currency ?? currency,
        paid_by: organizer,
        splits: equalSplits(members, amount),
        category: booking.category,
        source: "booking",
        booking_id: booking.id,
        package_id: pkg.id,
        created_at: booking.created_at,
      });
    }
  } else {
    // Package selected but not booked yet — still show projected split
    for (const c of pkg.components) {
      const id = `exp_pkg_${pkg.id}_${c.type}_${c.vendor}`.replace(/\s+/g, "_");
      upsertExpense({
        id,
        event_id: eventId,
        description: `${c.type} · ${c.vendor}`,
        amount: c.cost,
        currency: c.currency || currency,
        paid_by: organizer,
        splits: equalSplits(members, c.cost),
        category: c.type,
        source: "package",
        package_id: pkg.id,
        created_at: event.created_at,
      });
    }
  }

  return listExpenses(eventId);
}

export function getSplitSummary(eventId: string): SplitSummary | null {
  const event = getEvent(eventId);
  if (!event) return null;

  const expenses = syncExpensesFromBookings(eventId);
  const settlements = listSettlements(eventId);
  const member_ids = event.invitee_ids;
  const balances = computeBalances(member_ids, expenses, settlements);
  const settles = suggestSettlements(balances);
  const currency =
    expenses[0]?.currency ||
    getPackage(event.selected_package_id ?? "")?.components[0]?.currency ||
    "USD";

  return {
    event_id: eventId,
    currency,
    expenses,
    settlements,
    balances,
    settles,
    member_ids,
  };
}

export function createManualExpense(input: {
  event_id: string;
  description: string;
  amount: number;
  paid_by: string;
  split_user_ids?: string[];
  currency?: string;
  category?: string;
}): Expense {
  const event = getEvent(input.event_id);
  if (!event) throw new Error("Event not found");
  const members =
    input.split_user_ids?.filter((id) => event.invitee_ids.includes(id)) ??
    event.invitee_ids;
  if (!event.invitee_ids.includes(input.paid_by)) {
    throw new Error("Payer must be in the group");
  }
  if (members.length === 0) throw new Error("No members to split with");
  if (!(input.amount > 0)) throw new Error("Amount must be positive");

  return addExpense({
    event_id: input.event_id,
    description: input.description.trim() || "Expense",
    amount: round2(input.amount),
    currency: input.currency ?? "USD",
    paid_by: input.paid_by,
    splits: equalSplits(members, round2(input.amount)),
    category: input.category,
    source: "manual",
  });
}

