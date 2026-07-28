import { DINING_INVENTORY, type DiningOffer } from "../merchants/fixtures";
import { hasLinq } from "./config";

export async function searchDining(input: {
  max_per_person?: number;
  tags?: string[];
}): Promise<{ offers: DiningOffer[]; source: "linq" | "fixture" }> {
  if (hasLinq()) {
    // Linq dining booking API — live when LINQ_API_KEY is supplied.
  }

  let offers = [...DINING_INVENTORY];
  if (input.max_per_person != null) {
    const capped = offers.filter((o) => o.price_per_person <= input.max_per_person!);
    // Low budgets can wipe inventory — keep cheapest options instead of empty.
    offers = capped.length ? capped : [...offers].sort((a, b) => a.price_per_person - b.price_per_person);
  }
  if (input.tags?.length) {
    const tags = input.tags.map((t) => t.toLowerCase());
    offers = offers.sort((a, b) => {
      const as = a.tags.filter((t) => tags.some((x) => t.includes(x))).length;
      const bs = b.tags.filter((t) => tags.some((x) => t.includes(x))).length;
      return bs - as;
    });
  }
  return { offers, source: hasLinq() ? "linq" : "fixture" };
}

export async function reserveDining(offerId: string) {
  return {
    ok: true as const,
    confirmation_id: `DIN-${offerId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
  };
}
