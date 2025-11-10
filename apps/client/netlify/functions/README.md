# Netlify Functions - Security Documentation

## API Proxy (`api-proxy.ts`)

The API proxy provides secure server-side access to Supabase using the service role key. It implements multiple layers of security to prevent abuse and unauthorized access.

### Security Features

#### 1. Table and Action Allowlist

Only explicitly allowed tables and operations can be accessed through the proxy.

**Configuration:**

```json
SUPABASE_PROXY_TABLE_ALLOWLIST='{"users":["select","update"],"orders":["select","insert"]}'
```

This configuration allows:

- `users` table: SELECT and UPDATE operations only
- `orders` table: SELECT and INSERT operations only

#### 2. Column Allowlist for Filters

Filter operations are restricted to explicitly allowed columns to prevent bypassing Row Level Security (RLS) policies.

**Configuration:**

```json
SUPABASE_PROXY_COLUMN_ALLOWLIST='{"users":["id","email","role"],"orders":["id","user_id","status"]}'
```

This ensures that filters can only be applied to the specified columns. Any attempt to filter on other columns will be rejected with a 403 error.

**Why this matters:**

- Prevents attackers from crafting queries that bypass RLS policies
- Limits the ability to probe database structure
- Reduces the attack surface for SQL injection attempts

#### 3. Role-Based Access Control

Only users with specific roles can access the proxy.

**Configuration:**

```bash
SUPABASE_PROXY_ALLOWED_ROLES=ops,admin
```

Default: `ops,admin`

The proxy checks both `app_metadata.roles` and `user_metadata.roles` for the authenticated user.

#### 4. Rate Limiting

Prevents abuse by limiting the number of requests per user per minute.

**Configuration:**

```bash
SUPABASE_PROXY_RATE_LIMIT=100
```

Default: 100 requests per minute per user

When the rate limit is exceeded, the proxy returns a 429 status code with an appropriate error message.

**Implementation notes:**

- Uses in-memory storage (suitable for serverless functions)
- Rate limit window: 60 seconds
- For production with multiple function instances, consider using Redis or Netlify KV for distributed rate limiting

#### 5. Audit Logging

All proxy operations are logged with the following information:

- Timestamp
- Operation (select/insert/update/delete)
- Table name
- User ID
- User roles
- Success/failure status
- Error message (if applicable)

**Log format:**

```json
{
  "timestamp": "2025-11-10T08:06:48.977Z",
  "operation": "select",
  "table": "users",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "userRoles": ["admin"],
  "success": true
}
```

Logs are prefixed with `[PROXY_AUDIT]` for easy filtering and monitoring.

### Configuration Summary

Add these environment variables to your Netlify site settings:

```bash
# Required: Service role key and URL
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required: Table allowlist (JSON)
SUPABASE_PROXY_TABLE_ALLOWLIST='{"table_name":["action1","action2"]}'

# Required: Column allowlist for filters (JSON)
SUPABASE_PROXY_COLUMN_ALLOWLIST='{"table_name":["column1","column2"]}'

# Optional: Role-based access (default: ops,admin)
SUPABASE_PROXY_ALLOWED_ROLES=ops,admin

# Optional: Rate limit per user per minute (default: 100)
SUPABASE_PROXY_RATE_LIMIT=100
```

### Usage Example

```typescript
// Client-side code
const response = await fetch("/.netlify/functions/api-proxy", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "select",
    table: "users",
    columns: "id,email,role",
    filters: {
      role: "admin", // Must be in column allowlist
    },
  }),
});

const { data, error } = await response.json();
```

### Error Responses

| Status Code | Error                                   | Description                                              |
| ----------- | --------------------------------------- | -------------------------------------------------------- |
| 400         | Invalid or missing action               | Action must be 'select', 'insert', 'update', or 'delete' |
| 400         | Invalid or missing table                | Table name is required                                   |
| 400         | Filters required                        | Update and delete operations require filters             |
| 401         | Missing or invalid Authorization header | Bearer token is required                                 |
| 401         | Unauthorized                            | Invalid or expired access token                          |
| 403         | Proxy is disabled                       | SUPABASE_PROXY_TABLE_ALLOWLIST not configured            |
| 403         | Operation not allowed for this table    | Table/action combination not in allowlist                |
| 403         | Filter column not allowed               | Filter uses a column not in allowlist                    |
| 403         | Forbidden                               | User doesn't have required role                          |
| 429         | Rate limit exceeded                     | Too many requests from this user                         |
| 500         | Supabase configuration missing          | Missing environment variables                            |

### Security Best Practices

1. **Minimize allowlists**: Only add tables, actions, and columns that are absolutely necessary
2. **Monitor audit logs**: Regularly review logs for suspicious patterns
3. **Rotate keys**: Periodically rotate the service role key
4. **Use RLS policies**: The proxy bypasses RLS, so ensure your allowlists are strict
5. **Rate limiting**: Adjust rate limits based on your application's needs
6. **Column allowlists**: Always configure column allowlists to prevent unrestricted filtering

### Monitoring

To monitor proxy usage, search your logs for `[PROXY_AUDIT]`:

```bash
# Netlify CLI
netlify logs --filter "[PROXY_AUDIT]"

# or in the Netlify dashboard
# Functions > Logs > Search for "[PROXY_AUDIT]"
```

Look for:

- Failed authentication attempts (`success: false`, `Unauthorized`)
- Rate limit violations (`success: false`, `Rate limit exceeded`)
- Attempts to access unauthorized tables/columns
- Unusual patterns of access

### Limitations

- **In-memory rate limiting**: Rate limits are per-function instance. In a distributed environment, users may exceed the limit across multiple instances.
- **Service role bypass**: The proxy uses the service role key, which bypasses RLS. Ensure your allowlists are properly configured.
- **No query complexity limits**: Complex queries with large result sets may impact performance.

### Future Enhancements

Consider implementing:

- Redis/KV-based distributed rate limiting
- Query complexity analysis and limits
- More granular operation restrictions (e.g., limit operators like `eq`, `in`, `like`)
- IP-based rate limiting as an additional layer
- Webhook notifications for security events
