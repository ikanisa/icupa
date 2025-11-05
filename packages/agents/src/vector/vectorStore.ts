export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorQueryResult extends VectorRecord {
  score: number;
}

export interface VectorStore {
  namespace: string;
  upsert(records: VectorRecord[]): Promise<void>;
  query(query: number[], topK: number): Promise<VectorQueryResult[]>;
  delete(ids: string[]): Promise<void>;
}

export class InMemoryVectorStore implements VectorStore {
  private readonly store = new Map<string, VectorRecord>();

  constructor(public readonly namespace: string) {}

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.store.set(record.id, record);
    }
  }

  async query(query: number[], topK: number): Promise<VectorQueryResult[]> {
    const results: VectorQueryResult[] = [];
    for (const record of this.store.values()) {
      const score = cosineSimilarity(query, record.values);
      results.push({ ...record, score });
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    ids.forEach((id) => this.store.delete(id));
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }
  return dot / denominator;
}
