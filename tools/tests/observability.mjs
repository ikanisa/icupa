#!/usr/bin/env node
/**
 * Observability export smoke test.
 * Calls synthetics-probe and ensures no targets are failing.
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

async function main() {
  const response = await fetch(`${baseUrl}/functions/v1/synthetics-probe`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });

  if (!response.ok) {
    throw new Error(`synthetics-probe returned ${response.status}`);
  }

  const payload = await response.json();
  if (payload.fail_count > 0) {
    throw new Error(
      `synthetics-probe detected ${payload.fail_count} failing endpoints: ${JSON.stringify(payload.results)}`,
    );
  }

  const fallbackViolations = (payload.results ?? []).filter(
    (item) => item?.chaos?.fallback && !item.chaos.fallback_used,
  );

  if (fallbackViolations.length > 0) {
    throw new Error(
      `chaos policies active without fallback coverage: ${JSON.stringify(fallbackViolations)}`,
    );
  }

  const fallbackSummaries = (payload.results ?? [])
    .filter((item) => item?.chaos?.fallback_used)
    .map((item) => ({ fn: item.fn, fallback: item.chaos.fallback }));

  console.log("✅ Observability probe healthy", {
    okCount: payload.ok_count,
    checked: payload.results?.length ?? 0,
    fallbacks: fallbackSummaries,
  });
}

main().catch((error) => {
  console.error("❌ Observability checks failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
