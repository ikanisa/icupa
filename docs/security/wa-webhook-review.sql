-- REVIEW-ONLY SQL. Do not execute until the real Supabase project, data policy,
-- role grants and application source have been reviewed. Install with an actual
-- Supabase CLI-generated migration. Applies to PostgreSQL 15+.
-- The ONLY exposed RPC is a SECURITY INVOKER function executable by service_role.
CREATE SCHEMA IF NOT EXISTS wa_recovery;
REVOKE ALL ON SCHEMA wa_recovery FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA wa_recovery TO service_role;

CREATE TABLE IF NOT EXISTS wa_recovery.webhook_envelopes (
  body_sha text PRIMARY KEY CHECK (body_sha ~ '^[0-9a-f]{64}$'),
  ciphertext_b64 text NOT NULL CHECK (length(ciphertext_b64) BETWEEN 16 AND 2000000),
  nonce_b64 text NOT NULL CHECK (length(nonce_b64) BETWEEN 16 AND 24),
  key_version text NOT NULL CHECK (length(key_version) BETWEEN 1 AND 32),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  evidence_hold boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS wa_recovery.webhook_events (
  event_key text PRIMARY KEY CHECK (event_key ~ '^[0-9a-f]{64}$'),
  event_sha text NOT NULL CHECK (event_sha ~ '^[0-9a-f]{64}$'),
  envelope_sha text NOT NULL REFERENCES wa_recovery.webhook_envelopes(body_sha),
  waba_id text NOT NULL CHECK (waba_id ~ '^[0-9]{5,30}$'),
  phone_number_id text NOT NULL CHECK (phone_number_id ~ '^[0-9]{5,30}$'),
  kind text NOT NULL CHECK (kind IN ('message','status')),
  provider_event_id text NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 1024),
  provider_status text NOT NULL DEFAULT '' CHECK (length(provider_status) <= 64),
  provider_timestamp text NOT NULL DEFAULT '' CHECK (length(provider_timestamp) <= 64),
  state text NOT NULL DEFAULT 'held' CHECK (state IN ('held','leased','completed','quarantined')),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  evidence_hold boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS wa_webhook_events_state_received
  ON wa_recovery.webhook_events(state,received_at);
ALTER TABLE wa_recovery.webhook_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_recovery.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_recovery.webhook_envelopes FORCE ROW LEVEL SECURITY;
ALTER TABLE wa_recovery.webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA wa_recovery FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT ON wa_recovery.webhook_envelopes TO service_role;
GRANT SELECT,INSERT ON wa_recovery.webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.wa_ingest_verified_envelope(
  p_envelope jsonb, p_events jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  item jsonb;
  existing_sha text;
  n integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service principal required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_envelope) <> 'object'
      OR jsonb_typeof(p_events) <> 'array' THEN
    RAISE EXCEPTION 'malformed verified envelope';
  END IF;
  n := jsonb_array_length(p_events);
  IF n < 1 OR n > 1000
     OR coalesce(p_envelope->>'body_sha','') !~ '^[0-9a-f]{64}$'
     OR length(coalesce(p_envelope->>'ciphertext_b64','')) NOT BETWEEN 16 AND 2000000
     OR length(coalesce(p_envelope->>'nonce_b64','')) NOT BETWEEN 16 AND 24
     OR length(coalesce(p_envelope->>'key_version','')) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid verified envelope fields';
  END IF;
  INSERT INTO wa_recovery.webhook_envelopes (
      body_sha,ciphertext_b64,nonce_b64,key_version
  ) VALUES (
      p_envelope->>'body_sha',p_envelope->>'ciphertext_b64',
      p_envelope->>'nonce_b64',p_envelope->>'key_version'
  ) ON CONFLICT (body_sha) DO NOTHING;

  FOR item IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF jsonb_typeof(item) <> 'object'
       OR coalesce(item->>'event_key','') !~ '^[0-9a-f]{64}$'
       OR coalesce(item->>'event_sha','') !~ '^[0-9a-f]{64}$'
       OR coalesce(item->>'waba_id','') !~ '^[0-9]{5,30}$'
       OR coalesce(item->>'phone_number_id','') !~ '^[0-9]{5,30}$'
       OR item->>'kind' NOT IN ('message','status')
       OR length(coalesce(item->>'provider_event_id','')) NOT BETWEEN 1 AND 1024
       OR length(coalesce(item->>'provider_status','')) > 64
       OR length(coalesce(item->>'provider_timestamp','')) > 64 THEN
      RAISE EXCEPTION 'invalid verified event fields';
    END IF;
    INSERT INTO wa_recovery.webhook_events(
        event_key,event_sha,envelope_sha,waba_id,phone_number_id,
        kind,provider_event_id,provider_status,provider_timestamp
    ) VALUES (
        item->>'event_key',item->>'event_sha',p_envelope->>'body_sha',
        item->>'waba_id',item->>'phone_number_id',item->>'kind',
        item->>'provider_event_id',coalesce(item->>'provider_status',''),
        coalesce(item->>'provider_timestamp','')
    ) ON CONFLICT (event_key) DO NOTHING;
    SELECT event_sha INTO existing_sha FROM wa_recovery.webhook_events
      WHERE event_key=item->>'event_key';
    IF existing_sha IS DISTINCT FROM item->>'event_sha' THEN
      RAISE EXCEPTION 'webhook event identity collision';
    END IF;
  END LOOP;
  -- Atomic receipt; held events cannot trigger outbound messages.
  RETURN jsonb_build_object('committed',true,'events',n);
END;
$fn$;
REVOKE ALL ON FUNCTION public.wa_ingest_verified_envelope(jsonb,jsonb)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ingest_verified_envelope(jsonb,jsonb)
 TO service_role;
