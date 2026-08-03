import { describe, it, expect } from "vitest";
import { findPlacesInOrder } from "./airports";

describe("findPlacesInOrder", () => {
  it("orders by first mention in the text, not by the internal list order", () => {
    // Chicago is listed before Miami internally, but the sentence says Miami first.
    const hits = findPlacesInOrder("flights from Miami to Chicago please");
    expect(hits.map((h) => h.city)).toEqual(["Miami", "Chicago"]);
  });

  it("dedupes repeated mentions, keeping the earliest", () => {
    const hits = findPlacesInOrder("Chicago Chicago Chicago");
    expect(hits.map((h) => h.city)).toEqual(["Chicago"]);
  });

  it("returns an empty array for unrecognized text", () => {
    expect(findPlacesInOrder("book me something nice")).toEqual([]);
  });

  it("exposes the character index of the match", () => {
    const hits = findPlacesInOrder("I want to fly to Bali");
    expect(hits).toHaveLength(1);
    expect(hits[0].city).toBe("Bali");
    expect("I want to fly to Bali".slice(hits[0].index, hits[0].index + 4)).toBe("Bali");
  });
});
