#!/usr/bin/env node
import {
  EnvValidationError,
  assertSupabasePublicEnv,
} from "@ecotrips/config/env";

try {
  assertSupabasePublicEnv(process.env);
  console.log("[env] Client environment looks good.");
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error("[env] Client environment check failed.");
    if (error.missing.length > 0) {
      console.error(`[env] Missing: ${error.missing.join(", ")}`);
    }
    for (const issue of error.issues) {
      const path = issue.path.join(".") || issue.path[0] || "";
      console.error(`[env] ${path}: ${issue.message}`);
    }
    process.exit(1);
  }

  throw error;
}
