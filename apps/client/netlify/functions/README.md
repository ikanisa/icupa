# Netlify Functions

## API Proxy Security

The `api-proxy.ts` function provides a secure proxy for server-side Supabase operations using the service role key. It includes multiple layers of security to prevent abuse and unauthorized access.

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
