import { randomUUID } from "crypto";

export interface WhatsAppContact {
  phone: string;
  user_id: string;
  name: string;
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

/** Meta wants digits only (country code, no +). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
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
    return existing;
  }
  const contact: WhatsAppContact = {
    phone,
    user_id: input.user_id ?? `user_wa_${phone}`,
    name: input.name ?? `Friend ${phone.slice(-4)}`,
  };
  book().byPhone.set(phone, contact);
  return contact;
}

export function getContactByPhone(phone: string): WhatsAppContact | undefined {
  return book().byPhone.get(normalizePhone(phone));
}

export function listWhatsAppContacts(): WhatsAppContact[] {
  return [...book().byPhone.values()];
}

export function claimWhatsAppMessage(messageId: string): boolean {
  const ids = book().processedMessageIds;
  if (ids.has(messageId)) return false;
  ids.add(messageId);
  if (ids.size > 500) {
    const first = ids.values().next().value;
    if (first) ids.delete(first);
  }
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
