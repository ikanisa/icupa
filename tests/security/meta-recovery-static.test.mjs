import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
test("Rwanda not statically retired; Togo blocked",()=>{
 const send=read("apps/api/whatsapp/send.ts"), guard=read("supabase/functions/_shared/metaWebhookGuard.ts");
 assert.match(send,/RETIRED_SENDER_IDS\s*=\s*new Set\(\["396791596844039"\]\)/);
 assert.match(guard,/RETIRED\s*=\s*new Set\(\["396791596844039",\s*"22893002751"\]\)/);
 assert.doesNotMatch(send,/RETIRED_SENDER_IDS[^\n]*561637583695258/);
});
test("outbound requires explicit enable and allowlists",()=>{
 const send=read("apps/api/whatsapp/send.ts");
 for(const term of ["WA_OUTBOUND_ENABLED","WA_ALLOWED_SENDER_IDS","WA_ALLOWED_TEMPLATE_NAMES"])
  assert.ok(send.includes(term),term+" missing");
});
test("new webhook isolated, shared auth protected",()=>{
 const cfg=read("supabase/config.toml"),entry=read("supabase/functions/meta-wa-webhook/index.ts");
 assert.match(cfg,/\[functions\.meta-wa-webhook\]\s*verify_jwt\s*=\s*false/);
 assert.doesNotMatch(cfg,/\[functions\.auth\]\s*verify_jwt\s*=\s*false/);
 assert.match(entry,/createMetaWebhookHandler/);
 assert.match(entry,/createSupabaseDurableInbox/);
});
test("signed webhook checks raw body and does not issue ambiguous ACK",()=>{
 const x=read("supabase/functions/_shared/metaWebhookGuard.ts");
 for(const term of ["x-hub-signature-256","crypto.subtle.verify","WA_WEBHOOK_ALLOWED_BINDINGS","receipt.committed !== true"])
  assert.ok(x.includes(term),term+" missing");
 assert.match(x,/return answer\(503,\s*"durable_receipt_unconfirmed"\)/);
});
test("durable adapter encrypts, pins host, checks receipt",()=>{
 const x=read("supabase/functions/meta-wa-webhook/inbox.ts");
 for(const term of ["AES-GCM","WA_SUPABASE_EXPECTED_HOST","WA_WEBHOOK_AES256_KEY_B64","wa_ingest_verified_envelope","receipt.committed!==true"])
  assert.ok(x.includes(term),term+" missing");
});
test("database review scripts use service-only invoker and RLS",()=>{
 for(const file of ["docs/security/wa-webhook-review.sql","docs/security/wa-otp-review.sql"]) {
   const x=read(file);
   assert.match(x,/SECURITY INVOKER/);
   assert.match(x,/ENABLE ROW LEVEL SECURITY/);
   assert.match(x,/TO service_role/);
   assert.doesNotMatch(x,/SECURITY DEFINER/);
 }
});
test("old OTP entrypoints remain paused",()=>{
 const send=read("supabase/functions/auth/whatsapp_send_otp/index.ts"),
       verify=read("supabase/functions/auth/whatsapp_verify_otp/index.ts");
 for(const x of [send,verify]){
   assert.match(x,/\b503\b/);
   assert.doesNotMatch(x,/Math\.random\s*\(/);
 }
});
test("new OTP core is gated and never mints sessions",()=>{
 const x=read("supabase/functions/_shared/waOtpCore.ts");
 for(const term of ["WA_OTP_V2_ENABLED","getRandomValues","WA_OTP_APPROVED_TEMPLATE","396791596844039","store.consume"])
   assert.ok(x.includes(term),term+" missing");
 assert.doesNotMatch(x,/Math\.random\s*\(/);
 assert.doesNotMatch(x,/auth\.admin\.(createUser|generateLink)/);
});
test("deletion request page does not claim automated fulfilment",()=>{
 const x=read("public/data-deletion.html");
 assert.match(x,/mailto:info@ikanisa\.com/);
 assert.match(x,/Submission of a request is not confirmation that deletion has been completed/);
});
