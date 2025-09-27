import { Agent, Runner } from '@openai/agents';
import { OpenAIProvider, fileSearchTool, setDefaultOpenAIKey, setOpenAIAPI } from '@openai/agents-openai';
import { createAgentTools } from './tools';
import { AllergenGuardianOutputSchema, UpsellOutputSchema, WaiterOutputSchema } from './types';
import type { AgentSessionContext, UpsellSuggestion, AllergenGuardianOutput } from './types';
import { loadConfig } from '../config';
import { supabaseClient } from '../supabase';

const config = loadConfig();

setDefaultOpenAIKey(config.openai.apiKey);
if (!config.openai.responsesApi) {
  setOpenAIAPI('chat_completions');
}

const provider = new OpenAIProvider({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
  useResponses: config.openai.responsesApi
});

const { getMenu, checkAllergens, recommendItems, createOrder, getKitchenLoad } = createAgentTools({
  supabase: supabaseClient
});

const retrievalTools = config.openai.vectorStoreIds.length
  ? [
      fileSearchTool(config.openai.vectorStoreIds, {
        includeSearchResults: true,
        maxNumResults: 6
      })
    ]
  : [];

function buildLocaleInstruction(context: AgentSessionContext): string {
  const alcoholClause = context.avoidAlcohol
    ? 'Alcoholic beverages must not be suggested because the guest is not age verified.'
    : `Alcohol can be suggested when appropriate but remind guests of the legal drinking age (${context.legalDrinkingAge}+).`;

  return `You are assisting diners in region ${context.region}. Respond in ${context.language || 'English'} using clear, friendly sentences. ${alcoholClause}`;
}

export const upsellAgent = Agent.create<AgentSessionContext>({
  name: 'ICUPA Upsell Agent',
  instructions: async (runContext) => {
    const context = runContext.context;
    return `${buildLocaleInstruction(context)}
Use the available tools to retrieve menu knowledge and propose 2-3 upsell or pairing options. Never recommend items that conflict with declared allergens or age restrictions, and always include prices and citation tokens.`;
  },
  handoffDescription: 'Provides contextual menu pairings and upsell suggestions.',
  model: config.openai.defaultModel,
  tools: [getMenu, recommendItems, checkAllergens, getKitchenLoad, ...retrievalTools],
  outputType: UpsellOutputSchema
});

export const allergenGuardianAgent = Agent.create<AgentSessionContext>({
  name: 'ICUPA Allergen Guardian',
  instructions: async (runContext) => {
    const context = runContext.context;
    return `${buildLocaleInstruction(context)}
Validate the proposed upsell suggestions against the guest allergen list (${context.allergies.join(', ') || 'none declared'}). Flag any conflicts and explain the risk. If an item is blocked, provide a short explanation.`;
  },
  handoffDescription: 'Ensures the recommendations respect allergen policies and table safety rules.',
  model: config.openai.defaultModel,
  tools: [checkAllergens],
  outputType: AllergenGuardianOutputSchema
});

export const waiterAgent = Agent.create<AgentSessionContext>({
  name: 'ICUPA Waiter',
  instructions: async (runContext) => {
    const context = runContext.context;
    const suggestionSummary = (context.suggestions ?? []).map((item, index) => {
      return `${index + 1}. ${item.name} – ${(item.price_cents / 100).toFixed(2)} ${item.currency} (${item.citations.join(', ')})`;
    });

    const suggestionBulletList = suggestionSummary.length > 0 ? `Suggested upsells:\n${suggestionSummary.join('\n')}` : 'No upsell suggestions available.';

    return `${buildLocaleInstruction(context)}
Compose a concise response summarising the top items and why they fit. Quote prices with currency, reference allergens (or lack thereof), and include citation tokens so the UI can render source chips. Never surface a suggestion that was filtered out by safety checks.
${suggestionBulletList}`;
  },
  handoffDescription: 'Primary diner-facing waiter agent delivering grounded responses and upsell offers.',
  model: config.openai.defaultModel,
  tools: [getMenu, createOrder, getKitchenLoad, checkAllergens, ...retrievalTools],
  handoffs: [allergenGuardianAgent, upsellAgent],
  outputType: WaiterOutputSchema
});

export const runner = new Runner<AgentSessionContext>({
  modelProvider: provider,
  model: config.openai.defaultModel
});

export function applyAllergenFilter(
  suggestions: UpsellSuggestion[],
  guardianOutput: AllergenGuardianOutput
): UpsellSuggestion[] {
  if (!guardianOutput.blocked.length) return suggestions;
  const blockedIds = new Set(guardianOutput.blocked.map((item) => item.item_id));
  return suggestions.filter((suggestion) => !blockedIds.has(suggestion.item_id));
}
