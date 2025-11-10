# Netlify Functions

This directory contains serverless functions for the ICUPA client application.

## API Proxy (`api-proxy.ts`)

A secure proxy for Supabase operations that uses the service role key to perform privileged operations while maintaining security through multiple layers of protection.

### Security Features

The API proxy implements comprehensive security measures to prevent abuse and unauthorized access:

#### 1. Table and Action Allowlist

Only explicitly allowed tables and operations are permitted. Configure via:

```
SUPABASE_PROXY_TABLE_ALLOWLIST={"sessions":["select","update"],"orders":["select","insert","update"]}
```

#### 2. Column Allowlist for Filters

Filter operations are restricted to explicitly allowed columns. This prevents attackers from probing the database structure or accessing sensitive columns through filter queries.

```
SUPABASE_PROXY_COLUMN_ALLOWLIST={"sessions":["id","status","ended_at"],"orders":["id","status","tenant_id"]}
```

**Important**: If a table is not in the column allowlist, ALL filter operations on that table will be rejected, even if the table is in the table allowlist.

#### 3. Primitive-Only Filter Values

Only simple equality filters are allowed (string, number, boolean, null). Complex operations like:

- Array operations (`in`, `contains`)
- Range queries (`gt`, `lt`, `gte`, `lte`)
- Pattern matching (`like`, `ilike`)
- JSON operations

are **rejected** to prevent bypass of Row Level Security policies.

#### 4. Rate Limiting

Per-user rate limiting prevents abuse and DoS attacks:

```
SUPABASE_PROXY_RATE_LIMIT=60  # requests per minute per user
```

Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets

When rate limited, the endpoint returns HTTP 429 with a `Retry-After` header.

**Note**: The current implementation uses in-memory storage. For production deployments across multiple Netlify function instances, consider implementing distributed rate limiting using Redis or a similar solution.

#### 5. Audit Logging

All proxy operations are logged with:

- Timestamp
- User ID and email
- Action and table
- Applied filters
- Success/failure status
- Client IP address

Logs are written to stdout/stderr and tagged with `[AUDIT]` for easy filtering.

**Production Enhancement**: Consider writing audit logs to a dedicated Supabase table or external audit logging service for long-term retention and analysis.

#### 6. Role-Based Access Control

Only users with allowed roles can use the proxy:

```
SUPABASE_PROXY_ALLOWED_ROLES=ops,admin
```

Roles are checked from both `app_metadata.roles` and `user_metadata.roles`.

### Configuration

| Environment Variable              | Required | Default     | Description                                          |
| --------------------------------- | -------- | ----------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`               | Yes      | -           | Supabase project URL                                 |
| `SUPABASE_SERVICE_ROLE_KEY`       | Yes      | -           | Service role key (keep private)                      |
| `SUPABASE_PROXY_TABLE_ALLOWLIST`  | Yes      | `{}`        | JSON object mapping tables to allowed actions        |
| `SUPABASE_PROXY_COLUMN_ALLOWLIST` | Yes      | `{}`        | JSON object mapping tables to allowed filter columns |
| `SUPABASE_PROXY_ALLOWED_ROLES`    | No       | `ops,admin` | Comma-separated list of allowed roles                |
| `SUPABASE_PROXY_RATE_LIMIT`       | No       | `60`        | Maximum requests per minute per user                 |

### Usage Example

```typescript
// Client-side code
const response = await fetch("/.netlify/functions/api-proxy", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "select",
    table: "sessions",
    columns: "id,status,ended_at",
    filters: {
      id: "session-123",
      status: "active",
    },
  }),
});

const { data } = await response.json();
```

### Security Considerations

1. **Service Role Key**: The proxy uses the service role key which bypasses Row Level Security. Ensure your allowlists are properly configured.

2. **Column Allowlist is Required**: Do not skip configuring the column allowlist. Without it, users could probe your database structure.

3. **Filter Complexity**: Only simple equality filters are supported by design. If you need complex queries, consider creating dedicated RPC functions with proper security controls.

4. **Rate Limiting**: The in-memory rate limiter is suitable for single-instance deployments. For production, implement distributed rate limiting.

5. **Audit Logs**: Monitor audit logs regularly for suspicious activity. Consider implementing alerting for unusual patterns.

## Health Check (`health.ts`)

Simple health check endpoint that returns the service status.

### Usage

```bash
curl https://your-site.netlify.app/.netlify/functions/health
```

Returns: `{"status": "ok"}`
