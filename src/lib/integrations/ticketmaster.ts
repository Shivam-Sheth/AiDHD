import { TICKET_INVENTORY, type TicketOffer } from "../merchants/fixtures";
import { hasTicketmaster } from "./config";

export async function searchTickets(input: {
  keyword?: string;
  city?: string;
  max_price?: number;
}): Promise<{ offers: TicketOffer[]; source: "ticketmaster" | "fixture" }> {
  if (hasTicketmaster()) {
    try {
      const params = new URLSearchParams({
        apikey: process.env.TICKETMASTER_API_KEY!,
        keyword: input.keyword || "concert",
        city: input.city || "New York",
        size: "10",
      });
      const res = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          _embedded?: {
            events?: Array<{
              id: string;
              name: string;
              dates?: { start?: { dateTime?: string } };
              _embedded?: { venues?: Array<{ name?: string }> };
              priceRanges?: Array<{ min?: number; currency?: string }>;
            }>;
          };
        };
        const offers: TicketOffer[] = (data._embedded?.events ?? [])
          .slice(0, 5)
          .map((e) => ({
            id: e.id,
            event_name: e.name,
            vendor: "Ticketmaster",
            venue: e._embedded?.venues?.[0]?.name || "NYC Venue",
            date: e.dates?.start?.dateTime || new Date().toISOString(),
            tier: "Standard",
            price: e.priceRanges?.[0]?.min ?? 75,
            currency: e.priceRanges?.[0]?.currency || "USD",
            tags: ["live", "ticketmaster"],
          }));
        if (offers.length) return { offers, source: "ticketmaster" };
      }
    } catch {
      // fall through
    }
  }

  let offers = [...TICKET_INVENTORY];
  if (input.max_price != null) {
    offers = offers.filter((o) => o.price <= input.max_price!);
  }
  return { offers, source: "fixture" };
}

export async function reserveTicket(offerId: string, fail = false) {
  if (fail) {
    return {
      ok: false as const,
      confirmation_id: undefined,
      failure_reason: "Ticket tier sold out during hold window",
    };
  }
  return {
    ok: true as const,
    confirmation_id: `TM-${offerId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    failure_reason: undefined,
  };
}
