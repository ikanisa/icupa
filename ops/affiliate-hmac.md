# Affiliate webhook HMAC guide

EcoTrips affiliate integrations rely on a shared secret per partner stored in `affiliate.partner.signing_secret`. The edge
functions introduced in this change accept mock signatures that mirror the production format so we can exercise the end-to-end
flow without leaking credentials.

## Signature format

```
X-Eco-Affiliate-Partner: acme-travel
X-Eco-Affiliate-Timestamp: 1714675200
X-Eco-Affiliate-Signature: t=1714675200,v1=84a7bd...
```

* `timestamp` is a Unix epoch (seconds) captured when the payload is generated.
* The signature value is `hex(hmac_sha256(signing_secret, "{timestamp}.{raw_body}"))`.
* The inbound function rejects missing timestamps or signatures and records the attempt with `signature_status` metadata so ops
teams can review failures from the console.

## Local testing

1. Insert or update a partner row with a known secret (e.g., `update affiliate.partner set signing_secret = 'test-secret' where slug = 'acme-travel';`).
2. Generate a payload and signature:

```bash
TIMESTAMP=$(date +%s)
BODY='{"event":"booking.created","id":"evt_test"}'
SECRET='test-secret'
SIGNATURE=$(printf "%s.%s" "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)
```

3. Send the mock webhook:

```bash
curl -X POST \
  -H "X-Eco-Affiliate-Partner: acme-travel" \
  -H "X-Eco-Affiliate-Timestamp: $TIMESTAMP" \
  -H "X-Eco-Affiliate-Signature: t=$TIMESTAMP,v1=$SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  https://<your-project>.supabase.co/functions/v1/affiliate-inbound
```

4. Review the event in the admin console (`/affiliate/logs`) and confirm the signature is marked `valid`.

## Admin-triggered simulations

The `/affiliate/logs` admin page lets ops simulate outbound pushes via the `affiliate-outbound` edge function. These calls:

* Verify the operator has `ops` or `admin` role via Supabase RPC `is_ops`.
* Reuse the same HMAC algorithm to produce headers that partner sandboxes can validate.
* Store every call in `affiliate.events` with metadata such as the request ID, signature status, and any operator note.

> **Security reminder**: do not store production secrets in code or fixtures. Use Supabase SQL editors or secure env tooling to
manage partner secrets per environment.
