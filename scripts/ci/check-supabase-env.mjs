#!/usr/bin/env node

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
  `Missing Vite keys: ${missing.join(", ") || "none"}.`,
  `Missing Next.js-compatible keys: ${fallbackMissing.join(", ") || "none"}.`,
  "Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or their NEXT_PUBLIC equivalents) before running production builds.",
];

console.error(messages.join("\n"));
process.exit(1);
