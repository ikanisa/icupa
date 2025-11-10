import type { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

type ProxyAction = "select" | "insert" | "update" | "delete";

type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is";

type TableConfig = {
  actions: Set<ProxyAction>;
  allowedColumns?: Set<string>;
  allowedFilterColumns?: Set<string>;
  allowedFilterOperators?: Set<FilterOperator>;
};

type Allowlist = Record<string, TableConfig>;

type ProxyRequestBody = {
  action: ProxyAction;
  table: string;
  columns?: string;
  data?: unknown;
  filters?: Record<string, unknown>;
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
    return Object.entries(parsed).reduce<Allowlist>((acc, [table, config]) => {
      const normalizedTable = table.trim();
      if (!normalizedTable) {
        return acc;
      }

      // Support legacy format: table name -> array of actions
      if (Array.isArray(config)) {
        const allowedActions = config
          .map((action) => (typeof action === "string" ? action.trim().toLowerCase() : ""))
          .filter(
            (action): action is ProxyAction =>
              action === "select" ||
              action === "insert" ||
              action === "update" ||
              action === "delete",
          );

        if (allowedActions.length > 0) {
          acc[normalizedTable] = {
            actions: new Set(allowedActions),
          };
        }
        return acc;
      }

      // New format: table name -> object with actions, columns, and filter config
      if (!isRecord(config)) {
        return acc;
      }

      const { actions, allowedColumns, allowedFilterColumns, allowedFilterOperators } = config;

      if (!Array.isArray(actions)) {
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

      if (allowedActions.length === 0) {
        return acc;
      }

      const tableConfig: TableConfig = {
        actions: new Set(allowedActions),
      };

      // Parse allowed columns for select operations
      if (Array.isArray(allowedColumns)) {
        const columns = allowedColumns
          .map((col) => (typeof col === "string" ? col.trim() : ""))
          .filter(Boolean);
        if (columns.length > 0) {
          tableConfig.allowedColumns = new Set(columns);
        }
      }

      // Parse allowed filter columns
      if (Array.isArray(allowedFilterColumns)) {
        const filterCols = allowedFilterColumns
          .map((col) => (typeof col === "string" ? col.trim() : ""))
          .filter(Boolean);
        if (filterCols.length > 0) {
          tableConfig.allowedFilterColumns = new Set(filterCols);
        }
      }

      // Parse allowed filter operators
      if (Array.isArray(allowedFilterOperators)) {
        const operators = allowedFilterOperators
          .map((op) => (typeof op === "string" ? op.trim().toLowerCase() : ""))
          .filter(
            (op): op is FilterOperator =>
              op === "eq" ||
              op === "neq" ||
              op === "gt" ||
              op === "gte" ||
              op === "lt" ||
              op === "lte" ||
              op === "like" ||
              op === "ilike" ||
              op === "in" ||
              op === "is",
          );
        if (operators.length > 0) {
          tableConfig.allowedFilterOperators = new Set(operators);
        }
      }

      acc[normalizedTable] = tableConfig;
      return acc;
    }, {});
  } catch (error) {
    console.error("Failed to parse SUPABASE_PROXY_TABLE_ALLOWLIST:", error);
    return {};
  }
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

/**
 * Validates that requested columns are in the allowlist
 */
const validateColumns = (columns: string, allowedColumns?: Set<string>): boolean => {
  if (!allowedColumns || allowedColumns.size === 0) {
    return true; // No restriction
  }

  const requestedColumns = columns
    .split(",")
    .map((col) => col.trim())
    .filter(Boolean);

  // Allow '*' only if it's explicitly in the allowlist
  if (requestedColumns.includes("*")) {
    return allowedColumns.has("*");
  }

  // All requested columns must be in the allowlist
  return requestedColumns.every((col) => allowedColumns.has(col));
};

/**
 * Validates that filter keys are in the allowlist and extracts filter operations
 */
const validateFilters = (
  filters: Record<string, unknown>,
  allowedFilterColumns?: Set<string>,
  allowedFilterOperators?: Set<FilterOperator>,
): { valid: boolean; error?: string } => {
  if (!allowedFilterColumns && !allowedFilterOperators) {
    return { valid: true }; // No restrictions
  }

  for (const key of Object.keys(filters)) {
    // Check if column is allowed
    if (allowedFilterColumns && allowedFilterColumns.size > 0) {
      if (!allowedFilterColumns.has(key)) {
        return {
          valid: false,
          error: `Filter column '${key}' is not allowed`,
        };
      }
    }

    // For advanced filter operations (not yet implemented in this proxy)
    // Future: check operator types like { column: { $eq: value } }
  }

  return { valid: true };
};

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  checkLimit(identifier: string): { allowed: boolean; remainingMs?: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    const userRequests = this.requests.get(identifier) || [];

    // Filter out requests outside the window
    const recentRequests = userRequests.filter((timestamp) => timestamp > windowStart);

    if (recentRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const remainingMs = this.windowMs - (now - oldestRequest);
      return { allowed: false, remainingMs };
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    // Cleanup old entries periodically
    if (this.requests.size > 1000) {
      for (const [key, timestamps] of this.requests.entries()) {
        const recent = timestamps.filter((t) => t > windowStart);
        if (recent.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, recent);
        }
      }
    }

    return { allowed: true };
  }
}

// Initialize rate limiter: 60 requests per minute per user
const rateLimiter = new RateLimiter(60000, 60);

/**
 * Logs proxy operations for audit purposes
 */
const logProxyOperation = (
  userId: string,
  userEmail: string | undefined,
  action: ProxyAction,
  table: string,
  success: boolean,
  error?: string,
): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    userEmail: userEmail || "unknown",
    action,
    table,
    success,
    error,
  };

  console.log("[AUDIT] Proxy operation:", JSON.stringify(logEntry));
};

/**
 * Proxy API endpoint for secure Supabase operations
 * This allows server-side operations using the service role key
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
    const tableConfig = allowlist[normalizedTable];
    if (!tableConfig || !tableConfig.actions.has(action)) {
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

    // Validate columns for select operations
    if (action === "select" && payload.columns) {
      if (!validateColumns(payload.columns, tableConfig.allowedColumns)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "One or more requested columns are not allowed" }),
        };
      }
    }

    // Validate filters
    if (payload.filters) {
      const filterValidation = validateFilters(
        payload.filters,
        tableConfig.allowedFilterColumns,
        tableConfig.allowedFilterOperators,
      );
      if (!filterValidation.valid) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: filterValidation.error }),
        };
      }
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

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    // Rate limiting check
    const rateLimitCheck = rateLimiter.checkLimit(userId);
    if (!rateLimitCheck.allowed) {
      logProxyOperation(userId, userEmail, body.action, body.table, false, "Rate limit exceeded");
      return {
        statusCode: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimitCheck.remainingMs || 0) / 1000).toString(),
        },
        body: JSON.stringify({
          error: "Too many requests",
          retryAfter: Math.ceil((rateLimitCheck.remainingMs || 0) / 1000),
        }),
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
        logProxyOperation(
          userId,
          userEmail,
          body.action,
          body.table,
          false,
          "Insufficient permissions",
        );
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Forbidden" }),
        };
      }
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
      logProxyOperation(userId, userEmail, body.action, body.table, false, result.error.message);
      return {
        statusCode: result.status ?? 400,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    logProxyOperation(userId, userEmail, body.action, body.table, true);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: result.data }),
    };
  } catch (error) {
    console.error("API proxy error:", error);
    // Try to log if we have userId available
    if (error instanceof Error) {
      console.error("[AUDIT] Proxy operation failed:", error.message);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
