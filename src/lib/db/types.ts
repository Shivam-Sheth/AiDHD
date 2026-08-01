export type Profile = {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  phone: string | null;
  avatar_url: string | null;
  updated_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type TripGroup = {
  id: string;
  name: string;
  destination: string;
  created_by: string;
  status: string;
  booking_event_id: string | null;
  source_reel_url: string | null;
  trip_brief: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TripGroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string | null;
  content: string;
  kind: "text" | "system" | "agent" | "reel" | "expense";
  meta: Record<string, unknown>;
  created_at: string;
};

export type ExpenseSplit = { user_id: string; amount: number };

export type GroupExpense = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  splits: ExpenseSplit[];
  category: string | null;
  source: "manual" | "booking" | "package" | "agent";
  created_at: string;
};

export type GroupSettlement = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  note: string | null;
  created_at: string;
};
