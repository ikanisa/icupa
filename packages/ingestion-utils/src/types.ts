export interface MenuSchemaItem {
  name: string;
  description?: string;
  price: number;
  currency: string;
  allergens?: string[];
  is_alcohol?: boolean;
  tags?: string[];
  confidence?: number;
}

export interface MenuSchemaCategory {
  name: string;
  items: MenuSchemaItem[];
}

export interface MenuSchemaPayload {
  currency: string;
  categories: MenuSchemaCategory[];
}

export interface StagingRow {
  category_name: string | null;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  allergens: string[] | null;
  tags: string[] | null;
  is_alcohol: boolean | null;
  confidence: number | null;
  media_url: string | null;
  flags: Record<string, unknown> | null;
}

export interface MergeOptions {
  ingestionCurrency?: string | null;
  minConfidence?: number;
  highPriceThresholdCents?: number | null;
}

export interface MergedItem extends StagingRow {
  id: string;
}

export interface MergeResult {
  items: StagingRow[];
  itemsCount: number;
  rawText: string;
  structured: MenuSchemaPayload;
  confidenceBuckets: Record<string, number>;
  maxPriceCents: number;
}

export interface PageResult {
  page: number;
  payload: MenuSchemaPayload;
  rawText: string;
}
