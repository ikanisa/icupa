import { applyPriceFlags, generateRawText, normaliseMenuPayload } from "./pricing.ts";
import type { MergeOptions, MergeResult, PageResult, StagingRow } from "./types.ts";

interface DedupeKeyOptions {
  currency?: string | null;
}

function buildKey(item: StagingRow, options: DedupeKeyOptions): string {
  const price = typeof item.price_cents === "number" ? item.price_cents : -1;
  const currency = item.currency ?? options.currency ?? "";
  return `${item.name.trim().toLowerCase()}::${price}::${currency}`;
}

function mergeFlags(target: Record<string, unknown> | null, source: Record<string, unknown> | null): Record<string, unknown> {
  return { ...(target ?? {}), ...(source ?? {}) };
}

export function mergePageResults(pages: PageResult[], options: MergeOptions = {}): MergeResult {
  const map = new Map<string, StagingRow>();
  const confidenceBuckets: Record<string, number> = {
    ge_90: 0,
    ge_75: 0,
    ge_55: 0,
    lt_55: 0,
  };

  for (const page of pages) {
    const rows = normaliseMenuPayload(page.payload, options);

    for (const row of rows) {
      const key = buildKey(row, { currency: row.currency ?? options.ingestionCurrency ?? null });
      const existing = map.get(key);

      if (!existing) {
        map.set(key, row);
      } else {
        // keep highest confidence description
        const existingConfidence = existing.confidence ?? 0;
        const incomingConfidence = row.confidence ?? 0;

        if (incomingConfidence > existingConfidence) {
          map.set(key, {
            ...row,
            flags: mergeFlags(existing.flags, row.flags),
          });
        } else {
          existing.flags = mergeFlags(existing.flags, row.flags);
        }
      }
    }
  }

  const items = Array.from(map.values()).sort((a, b) => {
    const categoryA = a.category_name ?? "zzz";
    const categoryB = b.category_name ?? "zzz";
    if (categoryA === categoryB) {
      return a.name.localeCompare(b.name);
    }
    return categoryA.localeCompare(categoryB);
  });

  applyPriceFlags(items, options);

  for (const item of items) {
    const confidence = item.confidence ?? 0;
    if (confidence >= 0.9) {
      confidenceBuckets.ge_90 += 1;
    } else if (confidence >= 0.75) {
      confidenceBuckets.ge_75 += 1;
    } else if (confidence >= 0.55) {
      confidenceBuckets.ge_55 += 1;
    } else {
      confidenceBuckets.lt_55 += 1;
    }
  }

  const categories = new Map<string, { name: string; items: StagingRow[] }>();

  for (const item of items) {
    const key = item.category_name ?? "Uncategorised";
    if (!categories.has(key)) {
      categories.set(key, { name: key, items: [] });
    }
    categories.get(key)!.items.push(item);
  }

  const structured = {
    currency: options.ingestionCurrency ?? pages[0]?.payload?.currency ?? "XXX",
    categories: Array.from(categories.values()).map((category) => ({
      name: category.name,
      items: category.items.map((i) => ({
        name: i.name,
        description: i.description ?? undefined,
        price: typeof i.price_cents === "number" ? i.price_cents / 100 : 0,
        currency: i.currency ?? options.ingestionCurrency ?? "XXX",
        allergens: i.allergens ?? undefined,
        is_alcohol: i.is_alcohol ?? undefined,
        tags: i.tags ?? undefined,
        confidence: i.confidence ?? undefined,
      })),
    })),
  };

  const rawText = generateRawText(items);
  const maxPriceCents = items.reduce((max, item) => Math.max(max, item.price_cents ?? 0), 0);

  return {
    items,
    itemsCount: items.length,
    rawText,
    structured,
    confidenceBuckets,
    maxPriceCents,
  };
}
