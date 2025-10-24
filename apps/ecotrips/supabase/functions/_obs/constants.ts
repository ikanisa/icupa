export const ERROR_CODES = {
  INPUT_INVALID: "INPUT_INVALID",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  SUPPLIER_TIMEOUT: "SUPPLIER_TIMEOUT",
  PAYMENT_PROVIDER_ERROR: "PAYMENT_PROVIDER_ERROR",
  DATA_CONFLICT: "DATA_CONFLICT",
  TRANSIENT_RETRY: "TRANSIENT_RETRY",
  UNKNOWN: "UNKNOWN"
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export const SLO_THRESHOLDS = {
  CHECKOUT_SUCCESS_RATE: 0.96,
  WEBHOOK_P95_MS: 3_000,
  BFF_P95_MS: 500
} as const;

export const OBS_EVENTS = {
  HTTP_REQUEST: "http.request",
  HTTP_RESPONSE: "http.response",
  HTTP_ERROR: "http.error",
  SYNTHETICS_SUMMARY: "synthetics.summary"
} as const;

export const HEALTH_RESPONSE_HEADERS = {
  "content-type": "application/json"
} as const;
