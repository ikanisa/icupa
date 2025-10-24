# Travel Provider Edge Functions

This release introduces offline-friendly provider connectors and the price watch registry. The table below lists each function,
its Supabase deployment URL, and sample payloads for quick smoke checks.

## Providers — Air

### `providers-air-search`
- **URL**: `/functions/v1/providers-air-search`
- **Method**: `POST`
- **Sample request**:
  ```json
  {
    "origin": "KGL",
    "destination": "NBO",
    "departureDate": "2024-08-14",
    "returnDate": "2024-08-20",
    "adults": 2,
    "children": 1,
    "currency": "USD"
  }
  ```
- **Sample response excerpt**:
  ```json
  {
    "ok": true,
    "request_id": "req-123",
    "source": "fixtures",
    "offers": [
      {
        "id": "WB452-Y",
        "carrier": "RwandAir",
        "price": {
          "currency": "USD",
          "total_cents": 24500
        }
      }
    ]
  }
  ```

### `providers-air-hold`
- **URL**: `/functions/v1/providers-air-hold`
- **Method**: `POST`
- **Sample request**:
  ```json
  {
    "offerId": "WB452-Y",
    "origin": "KGL",
    "destination": "NBO",
    "departureDate": "2024-08-14",
    "returnDate": "2024-08-20",
    "currency": "USD",
    "idempotencyKey": "chat-abc-001",
    "contact": "traveler@example.com"
  }
  ```
- **Sample response excerpt**:
  ```json
  {
    "ok": true,
    "hold_ref": "hold-9f3d...",
    "expires_at": "2024-08-14T18:05:00Z",
    "source": "fixtures"
  }
  ```

### `air-price-watch`
- **URL**: `/functions/v1/air-price-watch`
- **Method**: `POST`
- **Sample request**:
  ```json
  {
    "origin": "KGL",
    "destination": "NBO",
    "departureDate": "2024-08-14",
    "currency": "USD",
    "targetPrice": 325,
    "contact": "ops@example.com",
    "notes": "chat /watch price"
  }
  ```
- **Sample response excerpt**:
  ```json
  {
    "ok": true,
    "watch_id": "8c4f9e2c-...",
    "status": "active"
  }
  ```

## Providers — Stay

### `providers-stay-search`
- **URL**: `/functions/v1/providers-stay-search`
- **Method**: `POST`
- **Sample request**:
  ```json
  {
    "city": "Kigali",
    "checkIn": "2024-09-05",
    "checkOut": "2024-09-08",
    "adults": 2,
    "children": 0,
    "currency": "USD"
  }
  ```
- **Sample response excerpt**:
  ```json
  {
    "ok": true,
    "properties": [
      {
        "id": "KGL-LAKEWOOD",
        "name": "Lake Kivu Wood Lodge",
        "total_cents": 47400
      }
    ]
  }
  ```

### `providers-stay-quote`
- **URL**: `/functions/v1/providers-stay-quote`
- **Method**: `POST`
- **Sample request**:
  ```json
  {
    "propertyId": "KGL-LAKEWOOD",
    "planCode": "flex",
    "checkIn": "2024-09-05",
    "checkOut": "2024-09-08",
    "adults": 2,
    "children": 0,
    "currency": "USD"
  }
  ```
- **Sample response excerpt**:
  ```json
  {
    "ok": true,
    "quote": {
      "rate": {
        "total_cents": 54600
      },
      "inclusions": ["Daily breakfast", "Evening canoe tour"]
    }
  }
  ```

> _Notes_: All endpoints default to fixture mode when live supplier credentials are unavailable. Cache TTLs are documented in the
> descriptor metadata (`travelDescriptors`) and can be tuned via Supabase secrets.
