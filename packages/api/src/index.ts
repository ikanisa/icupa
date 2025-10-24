import { CheckoutInput, ContributionCreate, EscrowCreate, InventorySearchInput, PermitRequest, SupplierOrdersRequest, SupplierOrdersResponse, SupplierConfirmInput, SupplierConfirmResponse, FlagsConfigResponse, SynthGenerateInput, SynthGenerateResponse } from "@ecotrips/types";
import {
  DrSnapshotInput,
  GroupsOpsPayoutNowInput,
  GroupsPayoutReportQuery,
  InvoiceGenerateInput,
  RefundPolicySummarizeInput,
  RefundPolicySummarizeResponse,
  PrivacyErasureExecuteInput,
  PrivacyErasurePlanInput,
  PrivacyExportInput,
  PrivacyRequestInput,
  PrivacyReviewInput,
  PIIScanInput,
  PIIScanResponse,
} from "@ecotrips/types";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 10_000;

type HttpMethod = "GET" | "POST";

type FunctionDescriptor<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> = {
  path: string;
  method: HttpMethod;
  auth: "anon" | "user" | "service_role";
  input?: TInput;
  output?: TOutput;
  cacheTtlMs?: number;
};

type ClientOptions = {
  supabaseUrl: string;
  anonKey: string;
  getAccessToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
  defaultTimeoutMs?: number;
};

type RequestOptions = {
  idempotencyKey?: string;
  signal?: AbortSignal;
};

type FunctionMap = {
  [K in keyof typeof descriptors]: (typeof descriptors)[K];
};

type MapsClient = {
  tilesList(
    input?: z.infer<typeof MapsTilesListInput>,
    options?: RequestOptions,
  ): Promise<z.infer<typeof MapsTilesListResponse>>;
};

const paginatedResponse = z.object({
  ok: z.boolean(),
  data: z.array(z.record(z.any())).default([]),
  request_id: z.string().optional(),
  total: z.number().optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
});

const descriptors = {
  "inventory.search": {
    path: "/functions/v1/inventory-search",
    method: "POST",
    auth: "anon",
    input: InventorySearchInput,
    output: z.object({ ok: z.boolean(), items: z.array(z.record(z.any())).default([]), cacheHit: z.boolean().optional() }),
    cacheTtlMs: 600_000,
  },
  "inventory.quote": {
    path: "/functions/v1/inventory-quote",
    method: "POST",
    auth: "anon",
    input: z.object({ quoteId: z.string().min(1), locale: z.enum(["en", "rw"]).default("en") }),
    output: z.object({ ok: z.boolean(), quote: z.record(z.any()).optional() }),
    cacheTtlMs: 120_000,
  },
  "checkout.intent": {
    path: "/functions/v1/bff-checkout",
    method: "POST",
    auth: "user",
    input: CheckoutInput,
    output: z.object({ ok: z.boolean(), payment_intent_id: z.string().optional(), client_secret: z.string().optional(), ledger_entry_id: z.string().optional() }),
  },
  "checkout.escalate": {
    path: "/functions/v1/payment-escalate",
    method: "POST",
    auth: "user",
    input: PaymentEscalationInput,
    output: PaymentEscalationResponse,
  },
  "groups.create": {
    path: "/functions/v1/groups-create-escrow",
    method: "POST",
    auth: "user",
    input: EscrowCreate,
    output: z.object({ ok: z.boolean(), escrow_id: z.string().uuid().optional() }),
  },
  "groups.join": {
    path: "/functions/v1/groups-join",
    method: "POST",
    auth: "user",
    input: z.object({ escrowId: z.string().uuid(), inviteCode: z.string().min(4) }),
    output: z.object({ ok: z.boolean(), member_id: z.string().uuid().optional() }),
  },
  "groups.contribute": {
    path: "/functions/v1/groups-contribute",
    method: "POST",
    auth: "user",
    input: ContributionCreate,
    output: z.object({ ok: z.boolean(), contribution_id: z.string().uuid().optional() }),
  },
  "groups.suggest": {
    path: "/functions/v1/groups-suggest",
    method: "POST",
    auth: "anon",
    input: GroupSuggestionInput,
    output: GroupSuggestionResponse,
    cacheTtlMs: 30_000,
  },
  "permits.request": {
    path: "/functions/v1/permits-request",
    method: "POST",
    auth: "user",
    input: PermitRequest,
    output: z.object({ ok: z.boolean(), request_id: z.string().uuid().optional() }),
  },
  "wallet.offlinePack": {
    path: "/functions/v1/privacy-export",
    method: "POST",
    auth: "user",
    input: z.object({ itineraryId: z.string().uuid(), locale: z.enum(["en", "rw"]).default("en") }),
    output: z.object({ ok: z.boolean(), download_url: z.string().url().optional() }),
  },
  "ops.bookings": {
    path: "/functions/v1/ops-bookings",
    method: "GET",
    auth: "user",
    input: z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        supplier: z.string().optional(),
        page: z.number().int().positive().optional(),
        page_size: z.number().int().positive().max(100).optional(),
      })
      .partial()
      .default({}),
    output: paginatedResponse,
  },
  "ops.exceptions": {
    path: "/functions/v1/ops-exceptions",
    method: "GET",
    auth: "user",
    input: z
      .object({
        status: z.string().optional(),
        page: z.number().int().positive().optional(),
        page_size: z.number().int().positive().max(100).optional(),
      })
      .partial()
      .default({}),
    output: paginatedResponse,
  },
  "groups.payouts.report": {
    path: "/functions/v1/groups-payouts-report",
    method: "GET",
    auth: "user",
    input: GroupsPayoutReportQuery.default({}),
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      range: z
        .object({ from: z.string().nullable(), to: z.string().nullable() })
        .partial()
        .optional(),
      counts: z
        .array(
          z.object({
            status: z.string(),
            currency: z.string(),
            count: z.number(),
          }),
        )
        .default([]),
      recent: z
        .array(
          z.object({
            id: z.string().optional(),
            escrow_id: z.string().optional(),
            total_cents: z.number().optional(),
            currency: z.string().optional(),
            status: z.string().optional(),
            attempts: z.number().optional(),
            last_error: z.string().nullable().optional(),
            created_at: z.string().optional(),
          }),
        )
        .default([]),
    }),
  },
  "groups.ops.payoutNow": {
    path: "/functions/v1/groups-ops-payout-now",
    method: "POST",
    auth: "user",
    input: GroupsOpsPayoutNowInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      escrow_id: z.string().optional(),
      payout_id: z.string().optional(),
      payout_status: z.string().optional(),
      total_cents: z.number().optional(),
    }),
  },
  "fin.invoice.generate": {
    path: "/functions/v1/fin-invoice-generate",
    method: "POST",
    auth: "user",
    input: InvoiceGenerateInput,
    output: z.object({
      ok: z.boolean(),
      invoice_id: z.string().optional(),
      number: z.string().optional(),
      signed_url: z.string().optional(),
      reused: z.boolean().optional(),
    }),
  },
  "fin.refund.policySummarize": {
    path: "/functions/v1/refund-policy-summarize",
    method: "POST",
    auth: "user",
    input: RefundPolicySummarizeInput,
    output: RefundPolicySummarizeResponse,
  },
  "ops.refund": {
    path: "/functions/v1/ops-refund",
    method: "POST",
    auth: "user",
    input: z.object({
      itinerary_id: z.string().uuid(),
      amount_cents: z.number().int().positive(),
      reason: z.string().min(1).max(200),
    }),
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      refund_id: z.string().optional(),
      status: z.string().optional(),
      message: z.string().optional(),
    }),
  },
  "affiliate.outbound": {
    path: "/functions/v1/affiliate-outbound",
    method: "POST",
    auth: "user",
    input: AffiliateOutboundInput,
    output: AffiliateOutboundResult,
  },
  "privacy.request": {
    path: "/functions/v1/privacy-request",
    method: "POST",
    auth: "user",
    input: PrivacyRequestInput,
    output: z.object({ ok: z.boolean(), request_id: z.string().optional() }),
  },
  "privacy.review": {
    path: "/functions/v1/privacy-review",
    method: "POST",
    auth: "user",
    input: PrivacyReviewInput,
    output: z.object({ ok: z.boolean(), status: z.string().optional() }),
  },
  "privacy.export": {
    path: "/functions/v1/privacy-export",
    method: "POST",
    auth: "user",
    input: PrivacyExportInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      signed_url: z.string().optional(),
    }),
  },
  "privacy.erasure.plan": {
    path: "/functions/v1/privacy-erasure-dryrun",
    method: "POST",
    auth: "user",
    input: PrivacyErasurePlanInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      signed_url: z.string().optional(),
      plan: z
        .array(
          z.object({
            table: z.string(),
            schema: z.string(),
            action: z.string(),
            count: z.number(),
          }),
        )
        .optional(),
    }),
  },
  "privacy.erasure.execute": {
    path: "/functions/v1/privacy-erasure-execute",
    method: "POST",
    auth: "user",
    input: PrivacyErasureExecuteInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      summary: z
        .array(
          z.object({
            table: z.string(),
            schema: z.string(),
            action: z.string(),
            count: z.number(),
          }),
        )
        .optional(),
    }),
  },
  "privacy.pii.scan": {
    path: "/functions/v1/privacy-pii-scan",
    method: "POST",
    auth: "user",
    input: PIIScanInput,
    output: PIIScanResponse,
  },
  "dr.snapshot": {
    path: "/functions/v1/dr-snapshot",
    method: "POST",
    auth: "user",
    input: DrSnapshotInput,
    output: z.object({
      ok: z.boolean(),
      snapshot_id: z.string().optional(),
      object_path: z.string().optional(),
      bytes: z.number().optional(),
      sha256: z.string().optional(),
    }),
  },
  "supplier.orders": {
    path: "/functions/v1/supplier-orders",
    method: "GET",
    auth: "user",
    input: SupplierOrdersRequest.default({ include_badges: false }),
    output: SupplierOrdersResponse,
  },
  "supplier.confirm": {
    path: "/functions/v1/supplier-confirm",
    method: "POST",
    auth: "user",
    input: SupplierConfirmInput,
    output: SupplierConfirmResponse,
  },
  "flags.config": {
    path: "/functions/v1/flags-config",
    method: "GET",
    auth: "user",
    input: z.object({}).default({}),
    output: FlagsConfigResponse,
  },
  "admin.synth.generate": {
    path: "/functions/v1/synth-generate",
    method: "POST",
    auth: "user",
    input: SynthGenerateInput.default({}),
    output: SynthGenerateResponse,
  },
} satisfies Record<string, FunctionDescriptor<z.ZodTypeAny, z.ZodTypeAny>>;

export type DescriptorKey = keyof FunctionMap;

export class EcoTripsFunctionClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  readonly maps: MapsClient;

  constructor(private readonly options: ClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maps = {
      tilesList: (input, options) =>
        this.call(
          "maps.tiles.list",
          (input ?? {}) as z.infer<FunctionMap["maps.tiles.list"]["input"]>,
          options,
        ),
    };
  }

  async call<K extends DescriptorKey>(
    key: K,
    payload: z.infer<FunctionMap[K]["input"]>,
    requestOptions: RequestOptions = {},
  ): Promise<z.infer<FunctionMap[K]["output"]>> {
    const descriptor = descriptors[key];
    if (!descriptor) {
      throw new Error(`Unknown function descriptor: ${String(key)}`);
    }

    const parsedInput = descriptor.input
      ? descriptor.input.parse(payload ?? {})
      : (payload ?? {});
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = requestOptions.signal ?? controller.signal;

    try {
      let url = `${this.options.supabaseUrl}${descriptor.path}`;
      const headers = await this.buildHeaders(descriptor, requestOptions.idempotencyKey);
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
        throw new Error(
          `Function ${key} failed with ${response.status}: ${JSON.stringify(errorPayload)}`,
        );
      }

      const parsed = await safeJson(response);
      return descriptor.output ? descriptor.output.parse(parsed) : (parsed as never);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async buildHeaders(
    descriptor: FunctionDescriptor<z.ZodTypeAny, z.ZodTypeAny>,
    idempotencyKey?: string,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: this.options.anonKey,
    };

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    if (descriptor.auth === "anon") {
      headers.Authorization = `Bearer ${this.options.anonKey}`;
      return headers;
    }

    if (descriptor.auth === "user") {
      const token = (await this.options.getAccessToken?.()) ?? this.options.anonKey;
      headers.Authorization = `Bearer ${token}`;
      return headers;
    }

    throw new Error("Service role access is not available from the client SDK.");
  }
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse JSON response", { error, text });
    return { ok: false, raw: text };
  }
}

export function createEcoTripsFunctionClient(options: ClientOptions) {
  return new EcoTripsFunctionClient(options);
}

export const functionDescriptors = descriptors;

export * from "./mapRoute";

function buildQueryString(input: unknown): string {
  if (!input || typeof input !== "object") {
    return "";
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, serializeQueryValue(entry));
      }
      continue;
    }

    params.append(key, serializeQueryValue(value));
  }

  return params.toString();
}

function serializeQueryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}
