# Growth Edge Function Payload Samples

The following payloads illustrate how clients and internal automations interact with the new growth-focused edge functions. All calls expect JSON bodies unless noted otherwise and should include an `Idempotency-Key` header mirroring the `idempotency_key` property.

## referral-link

```json
{
  "inviter_user_id": "5b285a6c-6c6e-4104-9da5-5b0fb9a2a9aa",
  "invitee_email": "friend@example.com",
  "channel": ["email", "whatsapp"],
  "consent": true,
  "idempotency_key": "invite-friend@example.com-2024-10-02"
}
```

**Response excerpt:**

```json
{
  "ok": true,
  "referral_code": "5b285-fri-3a1d7c",
  "link": "https://go.ecotrips.earth/r/5b285-fri-3a1d7c",
  "status": "pending"
}
```

## reward-grant

```json
{
  "user_id": "5b285a6c-6c6e-4104-9da5-5b0fb9a2a9aa",
  "amount_cents": 2500,
  "currency": "USD",
  "source": "referral_bonus",
  "status": "granted",
  "idempotency_key": "reward-2024-10-02-2500",
  "consent": true,
  "metadata": {
    "campaign": "october-boost"
  }
}
```

## price-lock-offer

```json
{
  "itinerary_id": "fe4a0f5c-6c5f-4c1a-8f28-4743cf8ad40c",
  "user_id": "5b285a6c-6c6e-4104-9da5-5b0fb9a2a9aa",
  "price_cents": 84200,
  "currency": "USD",
  "hold_reference": "HBX-123456",
  "hold_expires_at": "2024-10-02T15:06:00Z",
  "consent": true,
  "idempotency_key": "hold-fe4a0f5c-2024-10-02"
}
```

## hold-extend-offer

```json
{
  "offer_id": "d28f7d4e-46f6-4d62-aec7-3bf65d4fd0c5",
  "extension_minutes": 10,
  "idempotency_key": "extend-d28f7d4e-2024-10-02",
  "reason": "traveller reviewing quote"
}
```

## providers-air-status (GET)

```
GET /functions/v1/providers-air-status?provider=mockair&flight=EC202&date=2024-10-02
```

**Fixture response excerpt:**

```json
{
  "ok": true,
  "provider": "mockair",
  "flight": "EC202",
  "status": {
    "reliability_score": 0.92,
    "segments": [
      {
        "leg": 1,
        "route": "KGL-NBO",
        "status": "on_time"
      }
    ]
  }
}
```

## rebook-suggest

```json
{
  "disruption_id": "2dc60082-3a9f-4a33-b4e4-8cc8a2dff860",
  "itinerary_id": "fe4a0f5c-6c5f-4c1a-8f28-4743cf8ad40c",
  "suggestion": {
    "summary": "Offer next flight EC202 with lounge access",
    "options": [
      {
        "carrier": "MockAir",
        "flight": "EC202",
        "departure": "2024-10-02T18:00:00Z"
      }
    ]
  },
  "consent": true,
  "idempotency_key": "rebook-2dc60082-2024-10-02"
}
```
