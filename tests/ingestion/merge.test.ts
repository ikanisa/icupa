import { describe, expect, it } from "vitest";
import { mergePageResults } from "@icupa/ingestion-utils/merge";
import type { PageResult } from "@icupa/ingestion-utils/types";

const basePayload = {
  currency: "EUR",
  categories: [
    {
      name: "Starters",
      items: [
        {
          name: "Burrata",
          description: "Creamy burrata with tomatoes",
          price: 12,
          currency: "EUR",
          allergens: ["dairy"],
          confidence: 0.91,
        },
        {
          name: "Burrata",
          description: "Duplicate entry",
          price: 12,
          currency: "EUR",
          allergens: ["dairy"],
          confidence: 0.6,
        },
      ],
    },
  ],
};

describe("mergePageResults", () => {
  it("deduplicates items keeping highest confidence", () => {
    const result = mergePageResults([
      {
        page: 1,
        payload: basePayload,
        rawText: JSON.stringify(basePayload),
      },
    ] satisfies PageResult[]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description).toContain("Creamy burrata");
    expect(result.items[0]?.confidence).toBeCloseTo(0.91);
  });

  it("flags high prices relative to distribution", () => {
    const payload = {
      currency: "EUR",
      categories: [
        {
          name: "Mains",
          items: [
            { name: "Burger", price: 15, currency: "EUR", confidence: 0.8 },
            { name: "Lobster", price: 220, currency: "EUR", confidence: 0.85 },
          ],
        },
      ],
    };

    const result = mergePageResults(
      [{ page: 1, payload, rawText: JSON.stringify(payload) }] satisfies PageResult[],
      { highPriceThresholdCents: 10_000 },
    );

    const highPriceItem = result.items.find((item) => item.name === "Lobster");
    expect(highPriceItem?.flags?.high_price).toBe(true);
    const burger = result.items.find((item) => item.name === "Burger");
    expect(burger?.flags?.high_price).toBeFalsy();
  });

  it("retains category structure for structured output", () => {
    const result = mergePageResults([
      { page: 1, payload: basePayload, rawText: "{}" },
    ] satisfies PageResult[]);

    expect(result.structured.categories).toHaveLength(1);
    expect(result.structured.categories[0]?.items).toHaveLength(1);
    expect(result.structured.categories[0]?.items[0]?.name).toBe("Burrata");
  });
});
