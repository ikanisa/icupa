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
## API Proxy Security

The `api-proxy.ts` function provides a secure proxy for server-side Supabase operations using the service role key. It includes multiple layers of security to prevent abuse and unauthorized access.
# Netlify Functions - Security Documentation

## API Proxy (`api-proxy.ts`)

The API proxy provides secure server-side access to Supabase using the service role key. It implements multiple layers of security to prevent abuse and unauthorized access.

### Security Features

#### 1. Table and Action Allowlist

Operations are restricted to explicitly allowed tables and actions via the `SUPABASE_PROXY_TABLE_ALLOWLIST` environment variable.

**Configuration Format:**

The allowlist supports two formats:

**Legacy format** (simple):

```json
{
  "table_name": ["select", "insert", "update", "delete"]
}
```

**Enhanced format** (with column and filter restrictions):

```json
{
  "table_name": {
    "actions": ["select", "update"],
    "allowedColumns": ["id", "name", "status", "*"],
    "allowedFilterColumns": ["id", "tenant_id"],
    "allowedFilterOperators": ["eq", "in"]
  }
}
```

**Configuration Options:**

- `actions`: Array of allowed operations (`select`, `insert`, `update`, `delete`)
- `allowedColumns` (optional): Array of columns that can be selected. Use `"*"` to allow all columns. If not specified, no column restrictions apply.
- `allowedFilterColumns` (optional): Array of columns that can be used in filters. If not specified, no column restrictions apply.
- `allowedFilterOperators` (optional): Array of allowed filter operators. If not specified, all operators are allowed.

**Supported Filter Operators:**

- `eq`: Equal
- `neq`: Not equal
- `gt`: Greater than
- `gte`: Greater than or equal
- `lt`: Less than
- `lte`: Less than or equal
- `like`: Pattern matching (case-sensitive)
- `ilike`: Pattern matching (case-insensitive)
- `in`: In list
- `is`: Is null/true/false

**Example Configuration:**

```json
{
  "tenants": {
    "actions": ["select", "update"],
    "allowedColumns": ["id", "name", "status", "settings"],
    "allowedFilterColumns": ["id", "status"],
    "allowedFilterOperators": ["eq", "in"]
  },
  "products": {
    "actions": ["select"],
    "allowedColumns": ["*"],
    "allowedFilterColumns": ["tenant_id", "category_id", "status"],
    "allowedFilterOperators": ["eq"]
  }
}
```

#### 2. Column Validation

For `select` operations, the proxy validates that requested columns are in the allowlist:

- If `allowedColumns` is not specified, all columns are allowed
- If `allowedColumns` includes `"*"`, all columns are allowed
- Otherwise, only columns in the allowlist can be selected
- Attempting to select disallowed columns returns a 403 error

#### 3. Filter Validation

For operations with filters (`select`, `update`, `delete`):

- If `allowedFilterColumns` is specified, only those columns can be used in filters
- Attempting to filter on disallowed columns returns a 403 error with a descriptive message
- Filter operators can be restricted via `allowedFilterOperators` (future enhancement)

**Example:**

If `allowedFilterColumns` is `["id", "tenant_id"]`, these filters are valid:

```json
{ "id": 123 }
{ "tenant_id": "abc-123" }
```

But this filter would be rejected:

```json
{ "email": "user@example.com" }
// Error: Filter column 'email' is not allowed
```

#### 4. Rate Limiting

Built-in rate limiting prevents abuse:

- **Default limits:** 60 requests per minute per user
- Rate limiting is tracked by user ID (from JWT)
- When limit is exceeded:
  - Returns 429 (Too Many Requests) status
  - Includes `Retry-After` header with seconds to wait
  - Logs the rate limit violation for audit

**Rate Limit Response:**

```json
{
  "error": "Too many requests",
  "retryAfter": 30
}
```

**Customization:**

To modify rate limits, adjust the `RateLimiter` initialization:

```typescript
// 100 requests per 5 minutes per user
const rateLimiter = new RateLimiter(300000, 100);
```

#### 5. Audit Logging

All proxy operations are logged for security auditing:

**Log Format:**

```json
{
  "timestamp": "2025-11-10T08:00:00.000Z",
  "userId": "user-id-123",
  "userEmail": "user@example.com",
  "action": "select",
  "table": "tenants",
  "success": true,
  "error": null
}
```

**Logged Events:**

- All successful operations
- Failed operations (with error message)
- Rate limit violations
- Permission denials
- Invalid requests

Logs are written to stdout with the `[AUDIT]` prefix for easy filtering and monitoring.

#### 6. Role-Based Access Control

Access is restricted to users with specific roles:

- Controlled via `SUPABASE_PROXY_ALLOWED_ROLES` environment variable
- Default: `ops,admin`
- Roles are checked from user JWT metadata (`app_metadata.roles` and `user_metadata.roles`)
- Users must have at least one of the allowed roles

**Example:**

```
SUPABASE_PROXY_ALLOWED_ROLES=ops,admin,superuser
```

### Environment Variables

Required:

- `VITE_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (keep secret!)
- `SUPABASE_PROXY_TABLE_ALLOWLIST`: JSON string of allowed tables and operations

Optional:

- `SUPABASE_PROXY_ALLOWED_ROLES`: Comma-separated list of allowed roles (default: `ops,admin`)

### Usage Example

**Request:**

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/api-proxy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "select",
    "table": "tenants",
    "columns": "id,name,status",
    "filters": {
      "id": 123
    }
  }'
```

**Response (Success):**

```json
{
  "data": [
    {
      "id": 123,
      "name": "Example Tenant",
      "status": "active"
    }
  ]
}
```

**Response (Error - Disallowed Column):**

```json
{
  "error": "One or more requested columns are not allowed"
}
```

**Response (Error - Disallowed Filter):**

```json
{
  "error": "Filter column 'email' is not allowed"
}
```

### Security Best Practices

1. **Principle of Least Privilege:** Only allowlist tables and actions that are absolutely necessary
2. **Column Restrictions:** Use `allowedColumns` to prevent exposure of sensitive data
3. **Filter Restrictions:** Use `allowedFilterColumns` to prevent unauthorized data access patterns
4. **Monitor Logs:** Regularly review audit logs for suspicious activity
5. **Rate Limits:** Adjust rate limits based on your application's needs
6. **Role Checks:** Keep `SUPABASE_PROXY_ALLOWED_ROLES` as restrictive as possible

### Troubleshooting

**"Proxy is disabled" error:**

- Ensure `SUPABASE_PROXY_TABLE_ALLOWLIST` is configured
- Verify the JSON is valid

**"Operation not allowed for this table" error:**

- Check that the table and action are in the allowlist
- Verify JSON syntax in environment variable

**"One or more requested columns are not allowed" error:**

- Review `allowedColumns` configuration for the table
- Ensure requested columns are in the allowlist or use `"*"`

**"Filter column 'X' is not allowed" error:**

- Check `allowedFilterColumns` configuration
- Add the column to the allowlist if needed

**"Too many requests" error:**

- User has exceeded rate limit (60/minute by default)
- Wait for the `retryAfter` duration or increase limits if needed

**"Forbidden" error:**

- User doesn't have required role
- Check `SUPABASE_PROXY_ALLOWED_ROLES` and user's JWT metadata
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
const response = await fetch("/.netlify/functions/api-proxy", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    Authorization: `Bearer ${session.access_token}`,
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
