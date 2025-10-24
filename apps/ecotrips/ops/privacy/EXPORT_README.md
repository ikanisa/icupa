# Export Delivery

1. Generate the export bundle:
   ```sh
   curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/privacy-export" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"request_id":"<uuid>"}'
   ```
2. The response includes `signed_url`. Share this link via WhatsApp using the `link_notice` payload:
   ```sh
   curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/wa-send" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"type":"link_notice","to":"<user_msisdn>","text":"Your ecoTrips data export","url":"<signed_url>"}'
   ```
3. Links expire after 30 days. Re-run `privacy-export` for a fresh bundle if required (idempotent overwrite).
4. Storage objects live in the private bucket `privacy_exports/`. Clean-up occurs automatically when erasure executes.
