# Error Taxonomy

Use the following normalized error codes across ecoTrips functions. Log them via the observability wrapper and map internal exceptions accordingly.

- `INPUT_INVALID` – malformed payloads, missing fields, or validation failures.
- `AUTH_REQUIRED` – missing or invalid auth credentials; includes permission denials.
- `RATE_LIMITED` – exceeded throttling or quota constraints.
- `SUPPLIER_TIMEOUT` – downstream supplier API timed out or became unavailable.
- `PAYMENT_PROVIDER_ERROR` – payment gateway or processor failure.
- `DATA_CONFLICT` – optimistic locking, duplicate records, or mismatched state.
- `TRANSIENT_RETRY` – infrastructure hiccups that should succeed on retry (e.g., network blips).
- `UNKNOWN` – uncategorized exceptions; use sparingly and follow up with root-cause tagging.

Guidance:
- Prefer mapping exceptions to the closest code instead of emitting `UNKNOWN`.
- Keep sensitive values out of logs; reference opaque identifiers where required.
- When recovering from a transient error, log the event with `TRANSIENT_RETRY` and include retry metadata.
