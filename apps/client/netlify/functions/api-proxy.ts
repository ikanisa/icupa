import type { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

type ProxyAction = "select" | "insert" | "update" | "delete";

type Allowlist = Record<string, Set<ProxyAction>>;

type ColumnAllowlist = Record<string, Set<string>>;

type ProxyRequestBody = {
  action: ProxyAction;
  table: string;
  columns?: string;
  data?: unknown;
  filters?: Record<string, unknown>;
};

type AuditLogEntry = {
  timestamp: string;
  user_id: string;
  user_email?: string;
  action: ProxyAction;
  table: string;
  filters?: Record<string, unknown>;
  success: boolean;
  error?: string;
  ip_address?: string;
};

const DEFAULT_ALLOWED_ROLES = new Set(
  (process.env.SUPABASE_PROXY_ALLOWED_ROLES ?? "ops,admin")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean),
);

const parseAllowlist = (rawConfig: string | undefined): Allowlist => {
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Allowlist>((acc, [table, actions]) => {
      if (!Array.isArray(actions)) {
        return acc;
      }

      const normalizedTable = table.trim();
      if (!normalizedTable) {
        return acc;
      }

      const allowedActions = actions
        .map((action) => (typeof action === "string" ? action.trim().toLowerCase() : ""))
        .filter(
          (action): action is ProxyAction =>
            action === "select" ||
            action === "insert" ||
            action === "update" ||
            action === "delete",
        );

      if (allowedActions.length > 0) {
        acc[normalizedTable] = new Set(allowedActions);
      }

      return acc;
    }, {});
  } catch (error) {
    console.error("Failed to parse SUPABASE_PROXY_TABLE_ALLOWLIST:", error);
    return {};
  }
};

const parseColumnAllowlist = (rawConfig: string | undefined): ColumnAllowlist => {
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    return Object.entries(parsed).reduce<ColumnAllowlist>((acc, [table, columns]) => {
      if (!Array.isArray(columns)) {
        return acc;
      }

      const normalizedTable = table.trim();
      if (!normalizedTable) {
        return acc;
      }

      const allowedColumns = columns
        .map((col) => (typeof col === "string" ? col.trim() : ""))
        .filter(Boolean);

      if (allowedColumns.length > 0) {
        acc[normalizedTable] = new Set(allowedColumns);
      }

      return acc;
    }, {});
  } catch (error) {
    console.error("Failed to parse SUPABASE_PROXY_COLUMN_ALLOWLIST:", error);
    return {};
  }
};

const validateFilterKeys = (
  filters: Record<string, unknown>,
  table: string,
  columnAllowlist: ColumnAllowlist,
): { valid: boolean; error?: string } => {
  const allowedColumns = columnAllowlist[table];

  // If no column allowlist is configured for this table, reject all filters for security
  if (!allowedColumns || allowedColumns.size === 0) {
    return {
      valid: false,
      error: "No column allowlist configured for this table. Filters are not allowed.",
    };
  }

  // Validate each filter key is in the allowlist
  for (const key of Object.keys(filters)) {
    if (!allowedColumns.has(key)) {
      return {
        valid: false,
        error: `Column '${key}' is not allowed for filtering on table '${table}'`,
      };
    }
  }

  return { valid: true };
};

const validateFilterValues = (
  filters: Record<string, unknown>,
): { valid: boolean; error?: string } => {
  // Only allow simple equality filters (string, number, boolean, null)
  // Reject complex operations, arrays, objects, etc.
  for (const [key, value] of Object.entries(filters)) {
    const valueType = typeof value;

    // Allow primitive types and null
    if (
      value === null ||
      valueType === "string" ||
      valueType === "number" ||
      valueType === "boolean"
    ) {
      continue;
    }

    // Reject everything else (objects, arrays, functions, etc.)
    return {
      valid: false,
      error: `Filter value for '${key}' must be a primitive type (string, number, boolean, or null). Complex filter operations are not allowed.`,
    };
  }

  return { valid: true };
};

const logProxyOperation = async (entry: AuditLogEntry): Promise<void> => {
  // Log to console for now - in production, this should write to a secure audit log
  // or Supabase table with proper retention policies
  const logMessage = JSON.stringify({
    ...entry,
    source: "api-proxy",
  });

  if (entry.success) {
    console.log("[AUDIT]", logMessage);
  } else {
    console.error("[AUDIT]", logMessage);
  }

  // TODO: Consider writing to a dedicated audit_logs table in Supabase
  // This would require a separate Supabase client with elevated permissions
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeRoles = (roles: unknown): string[] => {
  if (Array.isArray(roles)) {
    return roles
      .map((role) => (typeof role === "string" ? role.toLowerCase() : ""))
      .filter(Boolean);
  }

  if (typeof roles === "string") {
    return [roles.toLowerCase()].filter(Boolean);
  }

  return [];
};

// Simple in-memory rate limiter
// In production, use Redis or a distributed rate limiting solution
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

const checkRateLimit = (
  userId: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } => {
  const now = Date.now();
  const key = `rate_limit:${userId}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
};

/**
 * Proxy API endpoint for secure Supabase operations
 * This allows server-side operations using the service role key
 *
 * Security features:
 * - Table and action allowlist
 * - Column allowlist for filters
 * - Primitive-only filter values (no complex operations)
 * - Rate limiting per user
 * - Audit logging of all operations
 */
export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowlist = parseAllowlist(process.env.SUPABASE_PROXY_TABLE_ALLOWLIST);
  const columnAllowlist = parseColumnAllowlist(process.env.SUPABASE_PROXY_COLUMN_ALLOWLIST);

  // Rate limiting configuration
  const maxRequestsPerMinute = parseInt(process.env.SUPABASE_PROXY_RATE_LIMIT ?? "60", 10);
  const rateLimitWindowMs = 60000; // 1 minute

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Supabase configuration missing" }),
    };
  }

  if (Object.keys(allowlist).length === 0) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: "Proxy is disabled. Configure SUPABASE_PROXY_TABLE_ALLOWLIST.",
      }),
    };
  }

  const authorizationHeader = event.headers.authorization ?? event.headers.Authorization;
  if (!authorizationHeader || !authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Missing or invalid Authorization header" }),
    };
  }

  const accessToken = authorizationHeader.slice(7).trim();
  if (!accessToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid access token" }),
    };
  }

  let body: ProxyRequestBody;
  try {
    const parsed = JSON.parse(event.body || "{}");
    const { action, table, columns, data, filters } = parsed as ProxyRequestBody;

    if (action !== "select" && action !== "insert" && action !== "update" && action !== "delete") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or missing action" }),
      };
    }

    if (typeof table !== "string" || !table.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or missing table" }),
      };
    }

    const normalizedTable = table.trim();
    const allowedActions = allowlist[normalizedTable];
    if (!allowedActions || !allowedActions.has(action)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Operation not allowed for this table" }),
      };
    }

    const payload: ProxyRequestBody = {
      action,
      table: normalizedTable,
      filters: isRecord(filters) ? filters : undefined,
    };

    // Validate filters if present
    if (payload.filters && Object.keys(payload.filters).length > 0) {
      // Validate filter keys against column allowlist
      const keyValidation = validateFilterKeys(payload.filters, normalizedTable, columnAllowlist);
      if (!keyValidation.valid) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: keyValidation.error }),
        };
      }

      // Validate filter values are primitive types only
      const valueValidation = validateFilterValues(payload.filters);
      if (!valueValidation.valid) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: valueValidation.error }),
        };
      }
    }

    if (typeof columns === "string" && columns.trim()) {
      payload.columns = columns.trim();
    }

    if (action === "select") {
      if (typeof data === "string" && data.trim() && !payload.columns) {
        payload.columns = data.trim();
      }
    } else if (action === "insert" || action === "update") {
      if (Array.isArray(data)) {
        const sanitized = data.filter(isRecord);
        if (sanitized.length !== data.length || sanitized.length === 0) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid data payload" }),
          };
        }
        payload.data = sanitized;
      } else if (isRecord(data)) {
        payload.data = data;
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid data payload" }),
        };
      }
    }

    if (
      (action === "update" || action === "delete") &&
      (!payload.filters || Object.keys(payload.filters).length === 0)
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Filters required for update and delete operations" }),
      };
    }

    body = payload;
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const userRoles = new Set<string>([
      ...normalizeRoles(userData.user.app_metadata?.roles),
      ...normalizeRoles(userData.user.user_metadata?.roles),
    ]);

    const allowedRoles = DEFAULT_ALLOWED_ROLES;
    if (allowedRoles.size > 0) {
      const hasAllowedRole = [...userRoles].some((role) => allowedRoles.has(role));
      if (!hasAllowedRole) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Forbidden" }),
        };
      }
    }

    // Check rate limit
    const rateLimit = checkRateLimit(userData.user.id, maxRequestsPerMinute, rateLimitWindowMs);
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      await logProxyOperation({
        timestamp: new Date().toISOString(),
        user_id: userData.user.id,
        user_email: userData.user.email,
        action: body.action,
        table: body.table,
        filters: body.filters,
        success: false,
        error: "Rate limit exceeded",
        ip_address: event.headers["x-forwarded-for"] || event.headers["client-ip"],
      });
      return {
        statusCode: 429,
        headers: {
          "Retry-After": resetIn.toString(),
          "X-RateLimit-Limit": maxRequestsPerMinute.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimit.resetAt.toString(),
        },
        body: JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: resetIn,
        }),
      };
    }

    const tableQuery = supabase.from(body.table);
    let result;

    switch (body.action) {
      case "select": {
        const columns = body.columns ?? "*";
        let query = tableQuery.select(columns);
        if (body.filters) {
          query = query.match(body.filters);
        }
        result = await query;
        break;
      }
      case "insert": {
        result = await tableQuery.insert(
          body.data as Record<string, unknown> | Record<string, unknown>[],
        );
        break;
      }
      case "update": {
        result = await tableQuery
          .update(body.data as Record<string, unknown> | Record<string, unknown>[])
          .match(body.filters!);
        break;
      }
      case "delete": {
        result = await tableQuery.delete().match(body.filters!);
        break;
      }
      default: {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Unsupported action" }),
        };
      }
    }

    if (result.error) {
      console.error("Supabase proxy error:", result.error);
      await logProxyOperation({
        timestamp: new Date().toISOString(),
        user_id: userData.user.id,
        user_email: userData.user.email,
        action: body.action,
        table: body.table,
        filters: body.filters,
        success: false,
        error: result.error.message,
        ip_address: event.headers["x-forwarded-for"] || event.headers["client-ip"],
      });
      return {
        statusCode: result.status ?? 400,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    // Log successful operation
    await logProxyOperation({
      timestamp: new Date().toISOString(),
      user_id: userData.user.id,
      user_email: userData.user.email,
      action: body.action,
      table: body.table,
      filters: body.filters,
      success: true,
      ip_address: event.headers["x-forwarded-for"] || event.headers["client-ip"],
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": maxRequestsPerMinute.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.resetAt.toString(),
      },
      body: JSON.stringify({ data: result.data }),
    };
  } catch (error) {
    console.error("API proxy error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
