import { Runner } from '@openai/agents';
import {
  OpenAIProvider,
  fileSearchTool,
  setDefaultOpenAIKey,
  setOpenAIAPI,
} from '@openai/agents-openai';
import { loadConfig } from '../config';

const config = loadConfig();

setDefaultOpenAIKey(config.openai.apiKey);
if (!config.openai.responsesApi) {
  setOpenAIAPI('chat_completions');
}

export const openAIProvider = new OpenAIProvider({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
  useResponses: config.openai.responsesApi,
});

export const openAIModels = {
  default: config.openai.defaultModel,
  lowCost: config.openai.lowCostModel,
};

export function buildRetrievalTools() {
  return config.openai.vectorStoreIds.length
    ? [
        fileSearchTool(config.openai.vectorStoreIds, {
          includeSearchResults: true,
          maxNumResults: 6,
        }),
      ]
    : [];
}

export function createRunner<TContext>() {
  return new Runner<TContext>({
    modelProvider: openAIProvider,
    model: config.openai.lowCostModel,
    maxToolDepth: 3,
  });
}

