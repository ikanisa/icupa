#!/usr/bin/env node

/**
 * check-supabase-env.mjs
 * 
 * Validates that required Supabase environment variables are present before builds.
 * 
 * For production builds, prefer VITE_* prefixed keys:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 * 
 * Fallback to NEXT_PUBLIC_* keys for Next.js compatibility:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 
 * Local development: Either set works, but we recommend VITE_* for consistency.
 * 
 * SERVER-ONLY keys (never prefix with VITE_ or NEXT_PUBLIC_):
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SUPABASE_URL (when used server-side without public prefix)
 */

const REQUIRED_PRIMARY_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const FALLBACK_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasAll(keys) {
  return keys.every((key) => normalize(process.env[key] ?? ""));
}

if (hasAll(REQUIRED_PRIMARY_KEYS) || hasAll(FALLBACK_KEYS)) {
  process.exit(0);
}

const missing = REQUIRED_PRIMARY_KEYS.filter((key) => !normalize(process.env[key] ?? ""));
const fallbackMissing = FALLBACK_KEYS.filter((key) => !normalize(process.env[key] ?? ""));

const messages = [
  "Supabase environment variables are required for builds.",
  `Missing Vite keys (preferred): ${missing.join(", ") || "none"}.`,
  `Missing Next.js-compatible keys (fallback): ${fallbackMissing.join(", ") || "none"}.`,
  "Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or their NEXT_PUBLIC equivalents) before running production builds.",
  "",
  "Note: For local development, either VITE_* or NEXT_PUBLIC_* keys work.",
  "      Server-only keys like SUPABASE_SERVICE_ROLE_KEY should never be exposed with these prefixes.",
];

console.error(messages.join("\n"));
process.exit(1);
