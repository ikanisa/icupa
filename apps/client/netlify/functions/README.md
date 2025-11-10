# Netlify Functions

## API Proxy (`api-proxy.ts`)

A secure Supabase proxy endpoint that allows server-side operations using the service role key with comprehensive security controls.

### Security Features

The API proxy implements multiple layers of security to prevent abuse and unauthorized access:

#### 1. Column Allowlist Validation

Filter keys are validated against an allowlist of permitted columns for each table. This prevents attackers from filtering on sensitive columns they shouldn't have access to.

**Configuration**: Set the `SUPABASE_PROXY_COLUMN_ALLOWLIST` environment variable with a JSON mapping:

```json
{
  "users": ["id", "email", "role"],
  "orders": ["id", "user_id", "status", "created_at"]
}
```

If no column allowlist is configured for a table, all filter operations will be rejected for security.

#### 2. Filter Operation Restrictions

Only simple equality filters are allowed. Complex filter operations using objects or arrays are rejected to prevent query injection attacks.

**Allowed**:
```json
{ "filters": { "id": "123", "status": "active" } }
```

**Rejected**:
```json
{ "filters": { "id": { "in": ["1", "2", "3"] } } }
```

#### 3. Rate Limiting

Each user is limited to a configurable number of requests per minute (default: 60). This prevents abuse and resource exhaustion.

**Configuration**: Set the `SUPABASE_PROXY_RATE_LIMIT` environment variable:

```bash
SUPABASE_PROXY_RATE_LIMIT=60
```

Rate limit state is stored in-memory. For production multi-instance deployments, consider implementing Redis-based rate limiting.

#### 4. Comprehensive Audit Logging

All proxy operations are logged with:
- Timestamp
- User ID and email
- Action and table
- Filters used
- Success/failure status
- Error messages (if applicable)

Logs are written to console with `[AUDIT] Supabase Proxy:` prefix and can be integrated with log aggregation services.

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side operations | Yes | - |
| `SUPABASE_PROXY_TABLE_ALLOWLIST` | JSON mapping of tables to allowed actions | Yes | `{}` |
| `SUPABASE_PROXY_COLUMN_ALLOWLIST` | JSON mapping of tables to allowed filter columns | Yes | `{}` |
| `SUPABASE_PROXY_ALLOWED_ROLES` | Comma-separated list of user roles | No | `ops,admin` |
| `SUPABASE_PROXY_RATE_LIMIT` | Requests per minute per user | No | `60` |

### Usage Example

```typescript
// Client-side code
const response = await fetch('/.netlify/functions/api-proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'select',
    table: 'users',
    columns: 'id,email,role',
    filters: { id: '123' }
  })
});

const { data } = await response.json();
```

### Security Best Practices

1. **Always configure column allowlists** - Never leave `SUPABASE_PROXY_COLUMN_ALLOWLIST` empty for tables that accept filters
2. **Use specific column lists** - Only allow filtering on non-sensitive columns
3. **Monitor audit logs** - Set up alerts for failed operations or suspicious patterns
4. **Adjust rate limits** - Tune based on your application's legitimate usage patterns
5. **Review RLS policies** - Remember that filters bypass RLS, so allowlists must be strict

### Limitations

- **In-memory rate limiting**: State is lost on instance restart. Consider Redis for production.
- **Simple filters only**: Complex Supabase query operators are not supported for security reasons.
- **No column validation for select**: The `columns` parameter is not validated against an allowlist (only filters are validated).

## Health Check (`health.ts`)

Simple health check endpoint for monitoring.
