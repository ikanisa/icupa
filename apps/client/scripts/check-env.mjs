#!/usr/bin/env node
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("Set NEXT_PUBLIC_SUPABASE_URL to your Supabase project URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "Set NEXT_PUBLIC_SUPABASE_ANON_KEY to your Supabase anon key."),
});

schema.parse(process.env);

console.log("[env] Client environment looks good.");
