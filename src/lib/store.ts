import { randomUUID } from "crypto";
import { DEMO_USERS } from "./demo-users";
import type {
  AgentRunLog,
  Booking,
  CollectorSession,
  Event,
  Mandate,
  Package,
  Response,
} from "./types";

interface StoreShape {
  events: Map<string, Event>;
  responses: Map<string, Response>;
  packages: Map<string, Package>;
  mandates: Map<string, Mandate>;
  bookings: Map<string, Booking>;
  collectors: Map<string, CollectorSession>;
  agentLogs: Map<string, AgentRunLog[]>;
  seeded: boolean;
}

const globalForStore = globalThis as unknown as { __aidhdStore?: StoreShape };

function createStore(): StoreShape {
  return {
    events: new Map(),
    responses: new Map(),
    packages: new Map(),
    mandates: new Map(),
    bookings: new Map(),
    collectors: new Map(),
    agentLogs: new Map(),
    seeded: false,
  };
}

export function getStore(): StoreShape {
  if (!globalForStore.__aidhdStore) {
    globalForStore.__aidhdStore = createStore();
  }
  return globalForStore.__aidhdStore;
}

export function resetStore() {
  globalForStore.__aidhdStore = createStore();
  seedDemoEvent();
}

export function seedDemoEvent(): Event {
  const store = getStore();
  if (store.seeded) {
    const existing = [...store.events.values()][0];
    if (existing) return existing;
  }

  const event: Event = {
    id: "evt_demo_friday",
    type: "outing",
    title: "Group outing",
    destination_or_venue: "Brooklyn / Manhattan",
    proposed_dates: ["2026-08-07", "2026-08-08"],
    organizer_id: DEMO_USERS[0].id,
    invitee_ids: DEMO_USERS.map((u) => u.id),
    status: "collecting",
    created_via: "web",
    created_at: new Date().toISOString(),
  };

  store.events.set(event.id, event);

  // Travel demo twin — same group, multi-day Miami trip
  const trip: Event = {
    id: "evt_demo_miami",
    type: "trip",
    title: "Group trip",
    destination_or_venue: "Miami Beach",
    proposed_dates: ["2026-08-14", "2026-08-15", "2026-08-16"],
    organizer_id: DEMO_USERS[0].id,
    invitee_ids: DEMO_USERS.map((u) => u.id),
    status: "collecting",
    created_via: "web",
    created_at: new Date().toISOString(),
  };
  store.events.set(trip.id, trip);

  store.seeded = true;
  return event;
}

export function ensureSeeded() {
  const store = getStore();
  if (!store.seeded || store.events.size === 0) {
    seedDemoEvent();
  }
}

export function listEvents(): Event[] {
  ensureSeeded();
  return [...getStore().events.values()];
}

export function getEvent(id: string): Event | undefined {
  ensureSeeded();
  return getStore().events.get(id);
}

export function upsertEvent(event: Event) {
  getStore().events.set(event.id, event);
}

export function listResponses(eventId: string): Response[] {
  return [...getStore().responses.values()].filter((r) => r.event_id === eventId);
}

export function addResponse(input: Omit<Response, "id" | "responded_at">): Response {
  const response: Response = {
    ...input,
    id: randomUUID(),
    responded_at: new Date().toISOString(),
  };
  getStore().responses.set(response.id, response);
  schedulePersist();
  return response;
}

export function upsertResponse(response: Response) {
  getStore().responses.set(response.id, response);
  schedulePersist();
  return response;
}

/** Latest response for a user on an event (if any). */
export function getResponseForUser(eventId: string, userId: string) {
  return listResponses(eventId)
    .filter((r) => r.user_id === userId)
    .sort((a, b) => b.responded_at.localeCompare(a.responded_at))[0];
}

export function listPackages(eventId: string): Package[] {
  return [...getStore().packages.values()].filter((p) => p.event_id === eventId);
}

export function setPackages(eventId: string, packages: Package[]) {
  const store = getStore();
  for (const [id, pkg] of store.packages) {
    if (pkg.event_id === eventId) store.packages.delete(id);
  }
  for (const pkg of packages) store.packages.set(pkg.id, pkg);
  schedulePersist();
}

export function getPackage(id: string) {
  return getStore().packages.get(id);
}

export function upsertPackage(pkg: Package) {
  getStore().packages.set(pkg.id, pkg);
  schedulePersist();
}

export function listMandates(eventId: string): Mandate[] {
  return [...getStore().mandates.values()].filter((m) => m.event_id === eventId);
}

export function upsertMandate(mandate: Mandate) {
  getStore().mandates.set(mandate.id, mandate);
}

export function getMandate(id: string) {
  return getStore().mandates.get(id);
}

export function listBookings(eventId: string): Booking[] {
  return [...getStore().bookings.values()].filter((b) => b.event_id === eventId);
}

export function upsertBooking(booking: Booking) {
  getStore().bookings.set(booking.id, booking);
}

export function getBooking(id: string) {
  return getStore().bookings.get(id);
}

export function collectorKey(eventId: string, userId: string) {
  return `${eventId}:${userId}`;
}

export function getCollector(eventId: string, userId: string) {
  return getStore().collectors.get(collectorKey(eventId, userId));
}

export function clearCollector(eventId: string, userId: string) {
  getStore().collectors.delete(collectorKey(eventId, userId));
  schedulePersist();
}

export function setCollector(session: CollectorSession) {
  getStore().collectors.set(
    collectorKey(session.event_id, session.user_id),
    session,
  );
  schedulePersist();
}

function schedulePersist() {
  try {
    void import("./state-sync").then((m) => m.scheduleDurableFlush());
  } catch {
    /* ignore */
  }
}

export function pushAgentLog(eventId: string, step: string, detail: string) {
  const store = getStore();
  const logs = store.agentLogs.get(eventId) ?? [];
  logs.push({ step, detail, at: new Date().toISOString() });
  store.agentLogs.set(eventId, logs);
}

export function getAgentLogs(eventId: string): AgentRunLog[] {
  return getStore().agentLogs.get(eventId) ?? [];
}

export function snapshot(eventId: string) {
  ensureSeeded();
  const event = getEvent(eventId);
  if (!event) return null;
  return {
    event,
    users: DEMO_USERS,
    responses: listResponses(eventId),
    packages: listPackages(eventId),
    mandates: listMandates(eventId),
    bookings: listBookings(eventId),
    agent_logs: getAgentLogs(eventId),
  };
}
