#!/usr/bin/env node

const OFFLINE_FLAGS = [
  "CI_OFFLINE",
  "OPSCONSOLE_BYPASS_AUTH",
  "OPSCONSOLE_OFFLINE_MODE",
  "OPS_CONSOLE_BYPASS_AUTH",
  "STRIPE_MOCK_MODE",
];

const missing = [];
if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE) {
  missing.push("SUPABASE_SERVICE_ROLE_KEY");
}

const offenders = OFFLINE_FLAGS.filter((flag) => {
  const value = process.env[flag];
  if (!value) return false;
  return new Set(["1", "true", "TRUE", "mock", "on"]).has(String(value));
});

if (missing.length > 0) {
  console.error(`Missing required Supabase env vars: ${missing.join(", ")}`);
  process.exitCode = 1;
}

if (offenders.length > 0) {
  console.error(`Disable offline flags before deployment: ${offenders.join(", ")}`);
  process.exitCode = 1;
}

if (process.exitCode) {
  console.error("Deployment guard: aborting because environment is not production ready.");
} else {
  console.log("Environment looks production-ready for live data.");
}
