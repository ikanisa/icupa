/**
 * Isolated, externally signed Meta callback (not the shared Supabase auth router).
 * Configure verify_jwt=false for THIS function only.
 * Safe default: WA_WEBHOOK_INGESTION_ENABLED unset -> valid POST is 503.
 * Stored events start in the held state; there is NO outbound worker.
 */
import { createMetaWebhookHandler } from "../_shared/metaWebhookGuard.ts";
import { createSupabaseDurableInbox } from "./inbox.ts";

const env=(key: string): string | undefined => Deno.env.get(key);
const handle=createMetaWebhookHandler(env,createSupabaseDurableInbox(env));
Deno.serve(handle);
