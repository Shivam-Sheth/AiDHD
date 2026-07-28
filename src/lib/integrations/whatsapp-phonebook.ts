import { randomUUID } from "crypto";

export interface WhatsAppContact {
  phone: string;
  user_id: string;
  name: string;
  /** Active demo event for this chat (outing vs trip). */
  event_id?: string;
  /** False until we've sent the freeform planning opener (needs user reply first). */
  planning_intro_sent?: boolean;
  /** Snapshot so VOTE works if another serverless instance lost in-memory packages. */
  last_packages?: Array<{
    id: string;
    label: string;
    cost_per_person: number;
    total_cost: number;
  }>;
  /** Waiting on date exception for consensus window */
  pending_date_exception?: string;
  /** Asked to raise budget toward group middle-ground */
  pending_budget_target?: number;
  /**
   * Mid-collect checkpoint — survives serverless hops when durable blob is wired.
   * Used to restore collector if in-memory session is missing.
   */
  collector_checkpoint?: {
    event_id: string;
    step:
      | "budget"
      | "origin"
      | "destination"
      | "availability"
      | "preferences"
      | "confirm"
      | "done";
    draft: Record<string, unknown>;
  };
}

interface PhonebookShape {
  byPhone: Map<string, WhatsAppContact>;
  processedMessageIds: Set<string>;
}

const globalForBook = globalThis as unknown as {
  __aidhdWhatsAppBook?: PhonebookShape;
};

function book(): PhonebookShape {
  if (!globalForBook.__aidhdWhatsAppBook) {
    globalForBook.__aidhdWhatsAppBook = {
      byPhone: new Map(),
      processedMessageIds: new Set(),
    };
  }
  return globalForBook.__aidhdWhatsAppBook;
}

/** Meta wants digits only (country code, no +). US 10-digit → prepend 1. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  // Drop a leading 00 international prefix if someone pastes that way
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

export function registerWhatsAppContact(input: {
  phone: string;
  name?: string;
  user_id?: string;
}): WhatsAppContact {
  const phone = normalizePhone(input.phone);
  const existing = book().byPhone.get(phone);
  if (existing) {
    if (input.name) existing.name = input.name;
    schedulePersist();
    return existing;
  }
  const contact: WhatsAppContact = {
    phone,
    user_id: input.user_id ?? `user_wa_${phone}`,
    name: input.name ?? `Friend ${phone.slice(-4)}`,
  };
  book().byPhone.set(phone, contact);
  schedulePersist();
  return contact;
}

function schedulePersist() {
  try {
    // Lazy to avoid circular import at module load
    void import("../state-sync").then((m) => m.scheduleDurableFlush());
  } catch {
    /* ignore */
  }
}

/** Replace phonebook from durable hydrate. */
export function replaceWhatsAppBook(input: {
  contacts: WhatsAppContact[];
  processedMessageIds?: string[];
}) {
  const next: PhonebookShape = {
    byPhone: new Map(),
    processedMessageIds: new Set(input.processedMessageIds ?? []),
  };
  for (const c of input.contacts) {
    if (c?.phone) next.byPhone.set(normalizePhone(c.phone), c);
  }
  globalForBook.__aidhdWhatsAppBook = next;
}

export function listProcessedMessageIds(): string[] {
  return [...book().processedMessageIds];
}

export function getContactByPhone(phone: string): WhatsAppContact | undefined {
  return book().byPhone.get(normalizePhone(phone));
}

export function setContactEventId(phone: string, eventId: string) {
  const contact = book().byPhone.get(normalizePhone(phone));
  if (contact) {
    contact.event_id = eventId;
    schedulePersist();
  }
  return contact;
}

export function setContactCheckpoint(
  phone: string,
  checkpoint: WhatsAppContact["collector_checkpoint"] | undefined,
) {
  const contact = book().byPhone.get(normalizePhone(phone));
  if (!contact) return;
  contact.collector_checkpoint = checkpoint;
  schedulePersist();
}

export function listWhatsAppContacts(): WhatsAppContact[] {
  return [...book().byPhone.values()];
}

export function getContactByUserId(userId: string): WhatsAppContact | undefined {
  return [...book().byPhone.values()].find((c) => c.user_id === userId);
}

export function claimWhatsAppMessage(messageId: string): boolean {
  const ids = book().processedMessageIds;
  if (ids.has(messageId)) return false;
  ids.add(messageId);
  if (ids.size > 500) {
    const first = ids.values().next().value;
    if (first) ids.delete(first);
  }
  schedulePersist();
  return true;
}

export function seedJordanPhoneIfConfigured() {
  const jordan = process.env.WHATSAPP_JORDAN_PHONE;
  if (jordan) {
    registerWhatsAppContact({
      phone: jordan,
      name: "Jordan",
      user_id: "user_jordan",
    });
  }
}

export function freshGuestId() {
  return `user_wa_${randomUUID().slice(0, 8)}`;
}

/** Clears phone→user map and processed message ids (demo reset). */
export function resetWhatsAppBook() {
  globalForBook.__aidhdWhatsAppBook = {
    byPhone: new Map(),
    processedMessageIds: new Set(),
  };
}
