#!/usr/bin/env node
/**
 * Contract smoke tests for Supabase edge functions.
 *
 * Requires the following environment variables:
 *  - SUPABASE_TEST_URL
 *  - SUPABASE_TEST_SERVICE_ROLE_KEY
 *  - SUPABASE_TEST_ANON_KEY (optional for anonymous health checks)
 */

const requiredEnv = ["SUPABASE_TEST_URL", "SUPABASE_TEST_SERVICE_ROLE_KEY"];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}.\n` +
      "Populate the testing credentials (see ops/PRODUCTION_READINESS.md).",
  );
  process.exit(1);
}

const baseUrl = process.env.SUPABASE_TEST_URL.replace(/\/$/, "");
const serviceRole = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? serviceRole;

async function requireHealth(fn) {
  const url = `${baseUrl}/functions/v1/${fn}/health`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });
  if (!response.ok) {
    throw new Error(`${fn} health returned ${response.status}`);
  }
  const body = await response.json();
  if (body?.ok !== true) {
    throw new Error(`${fn} health payload missing ok=true`);
  }
}

async function runOpsBookingsSample() {
  const url = `${baseUrl}/functions/v1/ops-bookings?from=2025-01-01&to=2025-12-31`;
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`ops-bookings returned ${response.status}`);
  }
  const json = await response.json();
  if (!json || json.ok !== true || !Array.isArray(json.data)) {
    throw new Error("ops-bookings payload unexpected");
  }
}

async function runMetricsIncrement() {
  const url = `${baseUrl}/functions/v1/metrics-incr`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({ name: "contracts.success", delta: 1 }),
  });
  if (!response.ok) {
    throw new Error(`metrics-incr returned ${response.status}`);
  }
  const json = await response.json();
  if (!json || json.ok !== true) {
    throw new Error("metrics-incr payload unexpected");
  }
}

async function main() {
  const checks = [
    () => requireHealth("bff-quote"),
    () => requireHealth("bff-checkout"),
    () => requireHealth("ops-bookings"),
    () => requireHealth("ops-exceptions"),
    () => requireHealth("ops-refund"),
    () => requireHealth("stripe-webhook"),
    () => requireHealth("wa-send"),
    () => requireHealth("metrics-incr"),
    () => requireHealth("groups-create-escrow"),
    () => requireHealth("groups-contribute"),
    () => requireHealth("groups-join"),
  ];

  for (const check of checks) {
    await check();
  }

  await runOpsBookingsSample();
  await runMetricsIncrement();

  console.log("✅ Contracts smoke suite passed");
}

main().catch((error) => {
  console.error("❌ Contract tests failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
