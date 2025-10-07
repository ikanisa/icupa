type PricingConfig = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const MODEL_PRICING: Record<string, PricingConfig> = {
  'gpt-4.1': { inputPerMillion: 5, outputPerMillion: 15 },
  'gpt-4o': { inputPerMillion: 5, outputPerMillion: 15 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 }
};

const DEFAULT_PRICING: PricingConfig = { inputPerMillion: 5, outputPerMillion: 15 };

export function estimateCostUsd(modelName: string, usage?: { inputTokens: number; outputTokens: number }): number {
  if (!usage) return 0;

  const pricing = MODEL_PRICING[modelName] ?? DEFAULT_PRICING;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  const total = inputCost + outputCost;
  return Number.isFinite(total) ? Number(total.toFixed(6)) : 0;
}
