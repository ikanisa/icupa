import type { MenuSchemaPayload, MergeOptions, StagingRow } from "./types.ts";

const DEFAULT_MIN_CONFIDENCE = 0.55;

interface PriceStats {
  mean: number;
  stddev: number;
  threshold: number;
}

export function priceToCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 100);
}

export function computePriceStats(prices: number[], fallbackThreshold = 150_000): PriceStats {
  if (!prices.length) {
    return { mean: 0, stddev: 0, threshold: fallbackThreshold };
  }
  const mean = prices.reduce((acc, val) => acc + val, 0) / prices.length;
  const variance =
    prices.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / Math.max(1, prices.length - 1);
  const stddev = Math.sqrt(variance);
  const dynamicThreshold = mean + 3 * stddev;
  return {
    mean,
    stddev,
    threshold: Math.min(dynamicThreshold, fallbackThreshold),
  };
}

export function normaliseMenuPayload(payload: MenuSchemaPayload, options: MergeOptions = {}): StagingRow[] {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const items: StagingRow[] = [];

  for (const category of payload.categories ?? []) {
    const categoryName = category?.name?.trim() || null;
    for (const item of category.items ?? []) {
      if (!item?.name) {
        continue;
      }

      const confidence = item.confidence ?? null;
      const priceCents = priceToCents(item.price);

      const row: StagingRow = {
        category_name: categoryName,
        name: item.name.trim(),
        description: item.description?.trim() ?? null,
        price_cents: priceCents,
        currency: item.currency ?? options.ingestionCurrency ?? null,
        allergens: item.allergens ?? null,
        tags: item.tags ?? null,
        is_alcohol: item.is_alcohol ?? null,
        confidence,
        media_url: null,
        flags: confidence !== null && confidence < minConfidence ? { low_confidence: true } : {},
      };

      items.push(row);
    }
  }

  return items;
}

export function applyPriceFlags(items: StagingRow[], options: MergeOptions = {}): void {
  const prices = items
    .map((item) => item.price_cents)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const stats = computePriceStats(prices, options.highPriceThresholdCents ?? 150_000);

  for (const item of items) {
    if (!item.flags) {
      item.flags = {};
    }

    if (typeof item.price_cents !== "number") {
      item.flags.missing_price = true;
      continue;
    }

    if (item.price_cents > stats.threshold) {
      item.flags = {
        ...item.flags,
        high_price: true,
        price_threshold: stats.threshold,
      };
    }
  }
}

export function generateRawText(items: StagingRow[]): string {
  return items
    .map((item) => {
      const price = typeof item.price_cents === "number" ? (item.price_cents / 100).toFixed(2) : "?";
      return `${item.category_name ?? "Uncategorised"} :: ${item.name} :: ${price} ${item.currency ?? ""}`;
    })
    .join("\n");
}
