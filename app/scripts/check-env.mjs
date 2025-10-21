#!/usr/bin/env node
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z
    .string()
    .url("Set SUPABASE_URL to your Supabase project URL."),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "Set SUPABASE_SERVICE_ROLE_KEY to your Supabase service role key."),
});

schema.parse(process.env);

console.log("[env] Marketing environment looks good.");
