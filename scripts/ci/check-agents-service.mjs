#!/usr/bin/env node

const REQUIRED_ENV = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const OPTIONAL_NUMERIC = {
  AGENT_SESSION_BUDGET_USD: {
    parser: (value) => Number.parseFloat(value),
    message: "must be a non-negative number",
  },
  AGENT_DAILY_BUDGET_USD: {
    parser: (value) => Number.parseFloat(value),
    message: "must be a non-negative number",
  },
  AGENT_TIMEOUT_MS: {
    parser: (value) => Number.parseInt(value, 10),
    message: "must be an integer greater than zero",
  },
};

const OPTIONAL_URL = ["OPENAI_BASE_URL"];

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message) {
  console.error(`\u274c Agents service configuration error: ${message}`);
  process.exit(1);
}

function validateRequired() {
  const missing = REQUIRED_ENV.filter((key) => !isNonEmpty(process.env[key]));
  if (missing.length > 0) {
    fail(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function validateUrlKeys() {
  for (const key of OPTIONAL_URL) {
    const value = process.env[key];
    if (isNonEmpty(value)) {
      try {
        new URL(value);
      } catch (error) {
        fail(`${key} is not a valid URL: ${(error && error.message) || String(error)}`);
      }
    }
  }
}

function validateNumbers() {
  for (const [key, { parser, message }] of Object.entries(OPTIONAL_NUMERIC)) {
    const value = process.env[key];
    if (!isNonEmpty(value)) continue;

    const parsed = parser(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      fail(`${key} ${message}. Received "${value}"`);
    }
  }
}

function validatePort() {
  const value = process.env.AGENTS_PORT;
  if (!isNonEmpty(value)) return;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    fail(`AGENTS_PORT must be an integer between 1 and 65535. Received "${value}".`);
  }
}

function logSummary() {
  const region = process.env.ICUPA_REGION || "not set";
  const vectorStores = [
    process.env.AGENTS_MENU_VECTOR_STORE_ID,
    process.env.AGENTS_ALLERGENS_VECTOR_STORE_ID,
    process.env.AGENTS_POLICIES_VECTOR_STORE_ID,
  ].filter(isNonEmpty);

  const summary = [
    "Agents service environment verified.",
    `Region: ${region}.`,
    `Vector stores configured: ${vectorStores.length > 0 ? vectorStores.join(", ") : "none"}.`,
  ];

  console.info(summary.join(" "));
}

validateRequired();
validateUrlKeys();
validateNumbers();
validatePort();
logSummary();
