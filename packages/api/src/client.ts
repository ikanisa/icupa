import { descriptors, type DescriptorKey, type FunctionMap } from "./descriptors";
import { buildHeaders, buildQueryString, resolveSignal, safeJson } from "./internal/http";
import { createDomainClients, type DomainClients } from "./clients";
import type { ClientOptions, InferInput, InferOutput, RequestOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

export class EcoTripsFunctionClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  readonly air: DomainClients["air"];
  readonly inventory: DomainClients["inventory"];
  readonly growth: DomainClients["growth"];
  readonly checkout: DomainClients["checkout"];
  readonly concierge: DomainClients["concierge"];
  readonly groups: DomainClients["groups"];
  readonly permits: DomainClients["permits"];
  readonly wallet: DomainClients["wallet"];
  readonly ops: DomainClients["ops"];
  readonly finance: DomainClients["finance"];
  readonly pricing: DomainClients["pricing"];
  readonly loyalty: DomainClients["loyalty"];
  readonly privacy: DomainClients["privacy"];
  readonly dr: DomainClients["dr"];
  readonly notify: DomainClients["notify"];
  readonly support: DomainClients["support"];
  readonly chat: DomainClients["chat"];

  constructor(private readonly options: ClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

    const domains = createDomainClients(this);
    this.air = domains.air;
    this.inventory = domains.inventory;
    this.growth = domains.growth;
    this.checkout = domains.checkout;
    this.concierge = domains.concierge;
    this.groups = domains.groups;
    this.permits = domains.permits;
    this.wallet = domains.wallet;
    this.ops = domains.ops;
    this.finance = domains.finance;
    this.pricing = domains.pricing;
    this.loyalty = domains.loyalty;
    this.privacy = domains.privacy;
    this.dr = domains.dr;
    this.notify = domains.notify;
    this.support = domains.support;
    this.chat = domains.chat;
  }

  async call<K extends DescriptorKey>(
    key: K,
    payload: InferInput<FunctionMap[K]>,
    requestOptions: RequestOptions = {},
  ): Promise<InferOutput<FunctionMap[K]>> {
    const descriptor = descriptors[key];
    if (!descriptor) {
      throw new Error(`Unknown function descriptor: ${String(key)}`);
    }

    const parsedInput = descriptor.input ? descriptor.input.parse(payload ?? {}) : (payload ?? {});
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = resolveSignal(requestOptions, controller);

    try {
      let url = `${this.options.supabaseUrl}${descriptor.path}`;
      const headers = await buildHeaders(descriptor, {
        anonKey: this.options.anonKey,
        getAccessToken: this.options.getAccessToken,
        idempotencyKey: requestOptions.idempotencyKey,
      });
      const init: RequestInit = {
        method: descriptor.method,
        signal,
        headers,
      };

      if (descriptor.method === "GET") {
        const query = buildQueryString(parsedInput);
        if (query) {
          url = `${url}?${query}`;
        }
      } else if (descriptor.method === "POST") {
        init.body = JSON.stringify(parsedInput);
      }

      const response = await this.fetchImpl(url, init);

      if (!response.ok) {
        const errorPayload = await safeJson(response);
        throw new Error(`Function ${String(key)} failed with ${response.status}: ${JSON.stringify(errorPayload)}`);
      }

      const parsed = await safeJson(response);
      const output = descriptor.output
        ? (descriptor.output.parse(parsed) as InferOutput<FunctionMap[K]>)
        : (parsed as InferOutput<FunctionMap[K]>);
      return output;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type EcoTripsClient = EcoTripsFunctionClient;

export function createEcoTripsFunctionClient(options: ClientOptions): EcoTripsClient {
  return new EcoTripsFunctionClient(options);
}

export const functionDescriptors = descriptors;
export { DEFAULT_TIMEOUT_MS };
