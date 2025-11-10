# API Proxy Security Documentation

## Overview

The Netlify API proxy (`apps/client/netlify/functions/api-proxy.ts`) provides a secure server-side interface for Supabase operations using the service role key. This document describes the security measures implemented to protect against unauthorized access and abuse.

## Security Features

### 1. Column Allowlist Validation

**Purpose**: Prevent arbitrary filter queries that could bypass Row Level Security (RLS) policies.

**Implementation**: 
- Filter keys are validated against a configurable allowlist of permitted columns per table
- Prevents attackers from querying sensitive columns not intended for proxy access
- Rejects requests if column allowlist is not configured for the table

**Configuration**:
```bash
SUPABASE_PROXY_COLUMN_ALLOWLIST='{"users": ["id", "email"], "orders": ["id", "user_id", "status"]}'
```

### 2. Filter Operator Restrictions

**Purpose**: Limit the types of filter operations to prevent SQL injection and abuse.

**Allowed Operators**:
- `eq` (equals)
- `neq` (not equals)
- `gt`, `gte` (greater than, greater than or equal)
- `lt`, `lte` (less than, less than or equal)
- `like`, `ilike` (pattern matching, case-insensitive pattern matching)
- `is` (null check)
- `in` (array membership)
- `cs`, `cd` (contains, contained by)

**Implementation**:
- Filter keys using operators (e.g., `email.eq`, `status.in`) are validated
- Unsupported operators are rejected with a clear error message

### 3. Rate Limiting

**Purpose**: Prevent abuse and DoS attacks by limiting request frequency per user.

**Configuration**:
```bash
SUPABASE_PROXY_RATE_LIMIT=60  # requests per minute per user (default: 60)
```

**Implementation**:
- In-memory rate limiter tracks requests per user ID
- Returns 429 (Too Many Requests) when limit exceeded
- Provides rate limit headers in response:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `Retry-After`: Seconds until rate limit resets

**Note**: For production deployments with multiple instances, consider replacing the in-memory implementation with Redis or a similar distributed cache.

### 4. Comprehensive Audit Logging

**Purpose**: Enable security monitoring and forensic analysis of proxy operations.

**Logged Information**:
- Timestamp
- User ID
- User roles
- Action performed (select, insert, update, delete)
- Table accessed
- Filters applied
- Success/failure status
- Error messages (if failed)
- IP address (from `x-forwarded-for` or `x-real-ip` headers)

**Log Format**:
```json
{
  "timestamp": "2025-11-10T08:00:00.000Z",
  "userId": "user-uuid",
  "userRoles": ["admin"],
  "action": "select",
  "table": "users",
  "filters": {"id.eq": "123"},
  "success": true,
  "ipAddress": "192.168.1.1"
}
```

**Log Levels**:
- Successful operations: `console.log` with `[AUDIT]` prefix
- Failed operations: `console.error` with `[AUDIT]` prefix

## Environment Variables

### Required Variables

```bash
# Supabase connection
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Table and action allowlist (required)
SUPABASE_PROXY_TABLE_ALLOWLIST='{"table_name": ["select", "insert", "update", "delete"]}'

# Column allowlist for filter validation (required for filter operations)
SUPABASE_PROXY_COLUMN_ALLOWLIST='{"table_name": ["column1", "column2"]}'
```

### Optional Variables

```bash
# Role-based access control (default: ops,admin)
SUPABASE_PROXY_ALLOWED_ROLES=ops,admin,manager

# Rate limiting (default: 60 requests per minute)
SUPABASE_PROXY_RATE_LIMIT=100
```

## Security Best Practices

### 1. Principle of Least Privilege
- Only include tables that absolutely require service role access in `SUPABASE_PROXY_TABLE_ALLOWLIST`
- Limit actions to the minimum required (e.g., only `select` if write operations aren't needed)
- Only include columns that need to be filterable in `SUPABASE_PROXY_COLUMN_ALLOWLIST`

### 2. Regular Audit Review
- Monitor audit logs regularly for suspicious patterns
- Set up alerts for high error rates or unusual access patterns
- Review logs after security incidents

### 3. Rate Limit Tuning
- Set `SUPABASE_PROXY_RATE_LIMIT` based on legitimate usage patterns
- Lower limits for stricter security, higher limits for better user experience
- Monitor 429 responses to identify if limits are too restrictive

### 4. Network Security
- Use Netlify's environment variables for secrets (never commit to source control)
- Consider IP allowlisting if proxy is only used by known services
- Enable Netlify's built-in DDoS protection

### 5. Column Allowlist Configuration
- Always configure column allowlists for tables that accept filter operations
- Review and update column allowlists when database schema changes
- Document the purpose of each allowed column

## Migration Guide

### Existing Deployments

If you're updating an existing deployment:

1. **Add Column Allowlist**: Configure `SUPABASE_PROXY_COLUMN_ALLOWLIST` for all tables in your table allowlist that use filters
   ```bash
   SUPABASE_PROXY_COLUMN_ALLOWLIST='{"users": ["id", "email", "status"], "orders": ["id", "user_id"]}'
   ```

2. **Test Filter Operations**: Verify that legitimate filter operations still work
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/api-proxy \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"action":"select","table":"users","filters":{"id.eq":"123"}}'
   ```

3. **Configure Rate Limits**: Set an appropriate rate limit based on your usage patterns
   ```bash
   SUPABASE_PROXY_RATE_LIMIT=60
   ```

4. **Monitor Logs**: Check audit logs for any rejected requests that might indicate configuration issues

## Error Messages

### Column Validation Errors

- `Column allowlist not configured for this table`: No column allowlist found for the requested table
- `Filter column 'column_name' is not allowed`: Attempted to filter on a column not in the allowlist
- `Filter operator 'operator' is not allowed`: Used an unsupported filter operator

### Rate Limiting Errors

- `Rate limit exceeded. Please try again later.`: User has exceeded their rate limit

## Testing

### Unit Testing Filter Validation

```typescript
// Valid filter
const validFilter = { 'id.eq': '123' };
const result = validateFilterKeys(validFilter, new Set(['id']));
// result.valid === true

// Invalid column
const invalidColumn = { 'secret.eq': 'value' };
const result2 = validateFilterKeys(invalidColumn, new Set(['id']));
// result2.valid === false, result2.error === "Filter column 'secret' is not allowed"

// Invalid operator
const invalidOp = { 'id.regex': 'pattern' };
const result3 = validateFilterKeys(invalidOp, new Set(['id']));
// result3.valid === false, result3.error === "Filter operator 'regex' is not allowed"
```

### Integration Testing

Test the complete proxy flow with various scenarios:
1. Valid requests with allowed columns and operators
2. Requests with disallowed columns
3. Requests with unsupported operators
4. Rate limit enforcement
5. Audit log generation

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Rate Limit Hits**: Track 429 responses
2. **Column Validation Failures**: Track 400 responses with column/operator errors
3. **Unauthorized Access Attempts**: Track 401/403 responses
4. **Request Volume**: Track overall request volume per user
5. **Error Rate**: Track percentage of failed operations

### Recommended Alerts

- Alert when rate limit hit rate exceeds threshold (e.g., >10% of requests)
- Alert on repeated validation failures from the same user
- Alert on unusual spike in proxy usage
- Alert on errors in audit logging system

## Future Enhancements

Potential improvements for future consideration:

1. **Distributed Rate Limiting**: Implement Redis-based rate limiting for multi-instance deployments
2. **Request Size Limits**: Add validation for request body size
3. **Advanced Logging**: Integrate with external logging services (e.g., Datadog, New Relic)
4. **IP-based Rate Limiting**: Add secondary rate limits based on IP address
5. **Anomaly Detection**: Implement ML-based anomaly detection for suspicious patterns
6. **Filter Complexity Limits**: Limit the number of filters per request
7. **Column Value Validation**: Add allowlists for column values (e.g., only specific status values)

## Support

For questions or issues related to API proxy security:
1. Check audit logs for detailed error information
2. Review environment variable configuration
3. Consult this documentation
4. Contact the security team
