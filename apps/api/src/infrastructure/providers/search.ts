import type { SearchProvider } from './types.js';
import { env } from '../../config/env.js';

class MockSearchProvider implements SearchProvider {
  readonly name = 'mock';
  async indexDocument(index: string, document: Record<string, unknown>) {
    if (!index) throw new Error('Index is required');
    if (!document.id) throw new Error('Document id is required');
  }
}

class AlgoliaSearchProvider implements SearchProvider {
  readonly name = 'algolia';
  async indexDocument() {
    throw new Error('Algolia provider not configured');
  }
}

const providers: Record<string, SearchProvider> = {
  mock: new MockSearchProvider(),
  algolia: new AlgoliaSearchProvider()
};

export const searchProvider = providers[env.SEARCH_PROVIDER] ?? providers.mock;
