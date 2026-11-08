-- REVIEW-ONLY extension to wa-webhook-review.sql. Not applied to any project.
-- Install with a Supabase CLI-generated migration after human schema review.
-- No client-side or anonymous privileges; only service_role may call RPC.
CREATE TABLE IF NOT EXISTS wa_recovery.otp_issuance_audit(
  challenge_id uuid PRIMARY KEY, phone_hash text NOT NULL
    CHECK (phone_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS otp_issuance_window
  ON wa_recovery.otp_issuance_audit(phone_hash,created_at DESC);
CREATE TABLE IF NOT EXISTS wa_recovery.otp_challenges(
  id uuid PRIMARY KEY REFERENCES wa_recovery.otp_issuance_audit(challenge_id),
  phone_hash text NOT NULL CHECK (phone_hash ~ '^[0-9a-f]{64}$'),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','submitted','uncertain','consumed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts=5),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at timestamptz
);
ALTER TABLE wa_recovery.otp_issuance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_recovery.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_recovery.otp_issuance_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE wa_recovery.otp_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON wa_recovery.otp_issuance_audit, wa_recovery.otp_challenges
  FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT ON wa_recovery.otp_issuance_audit TO service_role;
GRANT SELECT,INSERT,UPDATE ON wa_recovery.otp_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.wa_otp_issue(
  p_id uuid,p_phone_hash text,p_code_hash text,p_expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE n integer; now_ts timestamptz:=clock_timestamp();
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service principal required' USING ERRCODE='42501';
  END IF;
  IF p_phone_hash !~ '^[0-9a-f]{64}$' OR p_code_hash !~ '^[0-9a-f]{64}$'
    OR p_expires_at <= now_ts + interval '60 seconds'
    OR p_expires_at > now_ts + interval '600 seconds' THEN
    RAISE EXCEPTION 'invalid OTP challenge';
  END IF;
  -- Serializes requests for the SAME hashed phone; durable audit rows are
  -- never deleted on successful verification, unlike the legacy bug.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_phone_hash)
  );
  SELECT count(*) INTO n FROM wa_recovery.otp_issuance_audit
    WHERE phone_hash=p_phone_hash
      AND created_at >= now_ts - interval '2 minutes';
  IF n >= 3 THEN RETURN false; END IF;
  INSERT INTO wa_recovery.otp_issuance_audit(challenge_id,phone_hash)
    VALUES(p_id,p_phone_hash);
  INSERT INTO wa_recovery.otp_challenges(
    id,phone_hash,code_hash,expires_at
  ) VALUES(p_id,p_phone_hash,p_code_hash,p_expires_at);
  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.wa_otp_mark_submitted(
  p_id uuid,p_provider_message_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE n integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service principal required' USING ERRCODE='42501';
  END IF;
  IF length(coalesce(p_provider_message_id,'')) NOT BETWEEN 1 AND 512 THEN
    RAISE EXCEPTION 'invalid provider receipt';
  END IF;
  UPDATE wa_recovery.otp_challenges
    SET state='submitted',provider_message_id=p_provider_message_id
    WHERE id=p_id AND state='pending' AND expires_at>clock_timestamp();
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n=1;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.wa_otp_mark_uncertain(
  p_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE n integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service principal required' USING ERRCODE='42501';
  END IF;
  UPDATE wa_recovery.otp_challenges SET state='uncertain'
    WHERE id=p_id AND state='pending';
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n=1;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.wa_otp_consume(
  p_id uuid,p_phone_hash text,p_code_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE challenge wa_recovery.otp_challenges%ROWTYPE;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service principal required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO challenge FROM wa_recovery.otp_challenges
    WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR challenge.state<>'submitted'
    OR challenge.expires_at<=clock_timestamp()
    OR challenge.attempts>=challenge.max_attempts THEN RETURN false; END IF;
  -- Both phone mismatch and code mismatch burn a durable attempt.
  IF challenge.phone_hash<>p_phone_hash OR challenge.code_hash<>p_code_hash THEN
    UPDATE wa_recovery.otp_challenges SET attempts=attempts+1 WHERE id=p_id;
    RETURN false;
  END IF;
  UPDATE wa_recovery.otp_challenges SET state='consumed',
    attempts=attempts+1,consumed_at=clock_timestamp() WHERE id=p_id;
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.wa_otp_issue(uuid,text,text,timestamptz)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.wa_otp_mark_submitted(uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.wa_otp_mark_uncertain(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.wa_otp_consume(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_otp_issue(uuid,text,text,timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_otp_mark_submitted(uuid,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_otp_mark_uncertain(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_otp_consume(uuid,text,text)
  TO service_role;
