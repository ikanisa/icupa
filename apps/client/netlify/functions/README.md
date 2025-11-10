# Netlify Functions

## API Proxy (`api-proxy.ts`)

The API proxy provides secure server-side access to Supabase operations using the service role key.

### Security Features

#### 1. Column Allowlist Validation
Filter keys are validated against an allowlist of columns to prevent unauthorized data access.

#### 2. Rate Limiting
- 100 requests per minute per user
- Automatic cleanup of old rate limit entries
- Returns 429 status code when limit exceeded

#### 3. Audit Logging
All proxy operations are logged with:
- Timestamp
- User ID
- Action type
- Table name
- Filter keys used
- Success/failure status
- Error messages (if any)

#### 4. Restricted Filter Operations
The proxy only allows simple equality filters via the `match()` method, preventing complex SQL injection attacks.

### Configuration

#### Environment Variables

**Required:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server-side operations
- `SUPABASE_PROXY_TABLE_ALLOWLIST` - JSON configuration for allowed tables and operations

**Optional:**
- `SUPABASE_PROXY_ALLOWED_ROLES` - Comma-separated list of roles (default: "ops,admin")

#### Table Allowlist Configuration

The `SUPABASE_PROXY_TABLE_ALLOWLIST` environment variable supports two formats:

**Format 1: Simple (actions only)**
```json
{
  "profiles": ["select", "update"],
  "orders": ["select", "insert"]
}
```

**Format 2: Enhanced (with column allowlist)**
```json
{
  "profiles": {
    "actions": ["select", "update"],
    "filterableColumns": ["id", "user_id", "email"]
  },
  "orders": {
    "actions": ["select", "insert"],
    "filterableColumns": ["id", "user_id", "status"]
  }
}
```

**Important:** When using filters, you must specify `filterableColumns`. If no `filterableColumns` are specified, all filter operations will be rejected as a security precaution.

### Usage Example

```typescript
// Request with filters
fetch('/.netlify/functions/api-proxy', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <user-access-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'select',
    table: 'profiles',
    columns: 'id,name,email',
    filters: {
      id: '123',
      user_id: 'abc'
    }
  })
})
```

### Error Responses

- `401` - Missing or invalid authorization
- `403` - Operation not allowed or invalid filter columns
- `429` - Rate limit exceeded
- `400` - Invalid request format
- `500` - Server error

### Rate Limiting

The rate limiter is implemented in-memory and tracks requests per user:
- Window: 60 seconds
- Max requests: 100 per window
- Automatic cleanup every 5 minutes

For production deployments with multiple instances, consider implementing a distributed rate limiter using Redis or a similar service.
