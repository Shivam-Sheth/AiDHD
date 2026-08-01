import type { Channel } from "./types";

export type FriendshipStatus = "pending" | "accepted";

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  handle: string;
  channel: Channel;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export type GroupMessageKind = "text" | "system" | "reel" | "expense";

export interface GroupMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  kind: GroupMessageKind;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface ExpenseSplit {
  user_id: string;
  amount: number;
}

export type ExpenseSource = "manual" | "booking" | "package";

export interface Expense {
  id: string;
  event_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  splits: ExpenseSplit[];
  category?: string;
  source: ExpenseSource;
  booking_id?: string;
  package_id?: string;
  created_at: string;
}

export interface Settlement {
  id: string;
  event_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  note?: string;
  created_at: string;
}

export interface BalanceRow {
  user_id: string;
  name: string;
  net: number;
}

export interface TransferSuggestion {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount: number;
}

export interface SplitSummary {
  event_id: string;
  currency: string;
  expenses: Expense[];
  settlements: Settlement[];
  balances: BalanceRow[];
  settles: TransferSuggestion[];
  member_ids: string[];
}
