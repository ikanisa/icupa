const CANDIDATE_ENV_KEYS = [
  'VITE_AGENTS_URL',
  'PUBLIC_AGENTS_URL',
  'VITE_API_AGENTS_URL',
  'NEXT_PUBLIC_AGENTS_URL',
  'AGENTS_URL'
] as const;

function readEnvValue(key: (typeof CANDIDATE_ENV_KEYS)[number]): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    if (value) return value;
  }

  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value) return value;
  }

  return undefined;
}

let cachedBaseUrl: string | null | undefined;

export function getAgentsBaseUrl(): string | null {
  if (cachedBaseUrl !== undefined) {
    return cachedBaseUrl;
  }

  for (const key of CANDIDATE_ENV_KEYS) {
    const value = readEnvValue(key);
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    cachedBaseUrl = trimmed.replace(/\/$/, '');
    return cachedBaseUrl;
  }

  cachedBaseUrl = null;
  return cachedBaseUrl;
}

export function buildAgentUrl(path: string): string | null {
  const base = getAgentsBaseUrl();
  if (!base) return null;
  if (!path) return base;
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalisedPath}`;
}

export function agentFetch<T>(path: string, init: RequestInit): Promise<T> {
  const url = buildAgentUrl(path);
  if (!url) {
    return Promise.reject(new Error('Agents service URL is not configured.'));
  }

  return fetch(url, init).then(async (response) => {
    if (!response.ok) {
      const errorBody = await response.json().catch(() => undefined);
      const message = errorBody?.message ?? `Agent request failed with status ${response.status}`;
      const error = new Error(message) as Error & {
        status?: number;
        body?: unknown;
      };
      error.status = response.status;
      error.body = errorBody;
      throw error;
    }
    return (response.json() as Promise<T>);
  });
}

export function formatAgentCost(costUsd?: number | null): string | null {
  if (typeof costUsd !== 'number' || Number.isNaN(costUsd)) {
    return null;
  }
  if (costUsd < 0.01) {
    return '<$0.01';
  }
  return `$${costUsd.toFixed(2)}`;
}
