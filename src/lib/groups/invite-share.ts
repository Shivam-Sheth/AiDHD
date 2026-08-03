/** Phone / PWA invite helpers — contacts, share sheet, SMS, WhatsApp. */

export type PickedContact = {
  name: string;
  phone: string;
};

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const only = digits.replace(/\D/g, "");
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith("1")) return `+${only}`;
  return only ? `+${only}` : "";
}

export function contactsApiAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    contacts?: { select: (...args: unknown[]) => Promise<unknown> };
  };
  return typeof nav.contacts?.select === "function";
}

export function shareApiAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Android Chrome Contact Picker — not on iOS Safari. */
export async function pickContactsFromDevice(): Promise<PickedContact[]> {
  const nav = navigator as Navigator & {
    contacts?: {
      select: (
        properties: string[],
        opts?: { multiple?: boolean },
      ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
    };
  };
  if (!nav.contacts?.select) {
    throw new Error(
      "Contact picker isn't available on this device. Use Share link or paste numbers.",
    );
  }
  const raw = await nav.contacts.select(["name", "tel"], { multiple: true });
  const out: PickedContact[] = [];
  for (const c of raw || []) {
    const name = (c.name && c.name[0]) || "Friend";
    for (const tel of c.tel || []) {
      const phone = normalizePhone(tel);
      if (phone) out.push({ name, phone });
    }
  }
  return out;
}

export async function shareInviteLink(input: {
  url: string;
  title: string;
  text?: string;
}): Promise<"shared" | "copied" | "cancelled"> {
  const text =
    input.text ||
    `Join my AiDHD party — plan + book together: ${input.url}`;
  if (shareApiAvailable()) {
    try {
      await navigator.share({
        title: input.title,
        text,
        url: input.url,
      });
      return "shared";
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") return "cancelled";
      // fall through to copy
    }
  }
  await navigator.clipboard.writeText(input.url);
  return "copied";
}

export function smsInviteHref(url: string, phones?: string[]): string {
  const body = encodeURIComponent(`Join my AiDHD party: ${url}`);
  if (phones?.length === 1) {
    const n = phones[0]!.replace(/^\+/, "");
    return `sms:${n}?&body=${body}`;
  }
  // iOS multi: sms:/open?addresses= — keep simple open composer
  return `sms:?&body=${body}`;
}

export function whatsappShareHref(url: string, phone?: string): string {
  const text = encodeURIComponent(`Join my AiDHD party: ${url}`);
  if (phone) {
    const n = phone.replace(/\D/g, "");
    return `https://wa.me/${n}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}
