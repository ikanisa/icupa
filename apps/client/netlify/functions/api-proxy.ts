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

type ColumnAllowlist = Record<string, Set<string>>;

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'cs' | 'cd';

type ColumnAllowlist = Record<string, Set<string>>;

type TableConfig = {
  actions: Set<ProxyAction>;
  filterableColumns?: Set<string>;
};

type AllowlistConfig = Record<string, TableConfig>;

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
  userId: string;
  userRoles: string[];
  action: ProxyAction;
  table: string;
  filters?: Record<string, unknown>;
  success: boolean;
  error?: string;
  ip_address?: string;
  ipAddress?: string;
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_ALLOWED_ROLES = new Set(
  (process.env.SUPABASE_PROXY_ALLOWED_ROLES ?? "ops,admin")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean),
);

const parseAllowlist = (rawConfig: string | undefined): AllowlistConfig => {
// Rate limiting configuration (requests per minute per user)
const RATE_LIMIT_REQUESTS = parseInt(process.env.SUPABASE_PROXY_RATE_LIMIT ?? '60', 10);
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// In-memory rate limit store (consider using Redis for production multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

const parseAllowlist = (rawConfig: string | undefined): Allowlist => {
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    return Object.entries(parsed).reduce<AllowlistConfig>((acc, [table, config]) => {
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

      // Support both old format (array of actions) and new format (object with actions + filterableColumns)
      let actions: string[] = [];
      let filterableColumns: string[] | undefined;

      if (Array.isArray(config)) {
        // Old format: ["select", "insert"]
        actions = config;
      } else if (typeof config === 'object' && config !== null) {
        // New format: { actions: ["select"], filterableColumns: ["id", "name"] }
        const configObj = config as Record<string, unknown>;
        if (Array.isArray(configObj.actions)) {
          actions = configObj.actions;
        }
        if (Array.isArray(configObj.filterableColumns)) {
          filterableColumns = configObj.filterableColumns.filter((col): col is string => typeof col === 'string');
        }
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
      const allowedColumns = columns
        .map((col) => (typeof col === 'string' ? col.trim() : ''))
        .filter(Boolean);

      if (allowedColumns.length > 0) {
        acc[normalizedTable] = new Set(allowedColumns);
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

      if (allowedActions.length > 0) {
        acc[normalizedTable] = {
          actions: new Set(allowedActions),
          filterableColumns: filterableColumns ? new Set(filterableColumns) : undefined,
        };
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
    console.error('Failed to parse SUPABASE_PROXY_COLUMN_ALLOWLIST:', error);
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
const validateFilters = (
  filters: Record<string, unknown>,
  allowedColumns: Set<string> | undefined,
  tableName: string,
): { valid: boolean; error?: string } => {
  if (!allowedColumns) {
    return { valid: false, error: `No column allowlist configured for table: ${tableName}` };
  }

  for (const key of Object.keys(filters)) {
    if (!allowedColumns.has(key)) {
      return { valid: false, error: `Filter column not allowed: ${key}` };
const ALLOWED_FILTER_OPERATORS = new Set<FilterOperator>([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'cs', 'cd'
]);

const validateFilterKeys = (
  filters: Record<string, unknown>,
  allowedColumns: Set<string> | undefined
): { valid: boolean; error?: string } => {
  if (!allowedColumns || allowedColumns.size === 0) {
    // If no column allowlist is configured, reject all filter operations for security
    return { valid: false, error: 'Column allowlist not configured for this table' };
  }

  for (const key of Object.keys(filters)) {
    // Check if the key is a simple column name or uses an operator suffix
    const columnName = key.split('.')[0];
    
    if (!allowedColumns.has(columnName)) {
      return { valid: false, error: `Filter column '${columnName}' is not allowed` };
    }

    // If the key contains a dot, validate the operator
    if (key.includes('.')) {
      const operator = key.split('.')[1] as FilterOperator;
      if (!ALLOWED_FILTER_OPERATORS.has(operator)) {
        return { valid: false, error: `Filter operator '${operator}' is not allowed` };
      }
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
const logProxyOperation = (
  operation: string,
  table: string,
  userId: string,
  userRoles: string[],
  success: boolean,
  error?: string,
): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    table,
    userId,
    userRoles,
    success,
    error,
  };
  console.log('[PROXY_AUDIT]', JSON.stringify(logEntry));
};

// Simple in-memory rate limiter (for serverless, consider using Redis/KV in production)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (userId: string): { allowed: boolean; error?: string } => {
  const rateLimitWindow = 60000; // 1 minute window
  const maxRequests = parseInt(process.env.SUPABASE_PROXY_RATE_LIMIT ?? '100', 10);

  const now = Date.now();
  const userLimit = rateLimiter.get(userId);

  if (!userLimit || userLimit.resetTime < now) {
    rateLimiter.set(userId, { count: 1, resetTime: now + rateLimitWindow });
    return { allowed: true };
  }

  if (userLimit.count >= maxRequests) {
    return { allowed: false, error: 'Rate limit exceeded. Please try again later.' };
  }

  userLimit.count += 1;
  return { allowed: true };
const auditLog = (entry: AuditLogEntry): void => {
  // Log audit entries for security monitoring
  const logMessage = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  
  if (entry.success) {
    console.log('[AUDIT]', logMessage);
  } else {
    console.error('[AUDIT]', logMessage);
  }
};

// Simple in-memory rate limiter (for production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.SUPABASE_PROXY_RATE_LIMIT || '60', 10);

const checkRateLimit = (userId: string): { allowed: boolean; remaining: number } => {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count };
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
 * Check rate limit for a user
 * Returns true if rate limit is exceeded
 */
const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_REQUESTS) {
    return true;
  }

  entry.count += 1;
  return false;
};

/**
 * Validate filter keys against column allowlist
 * Returns an error message if validation fails, undefined otherwise
 */
const validateFilters = (
  filters: Record<string, unknown> | undefined,
  table: string,
  columnAllowlist: ColumnAllowlist,
): string | undefined => {
  if (!filters || Object.keys(filters).length === 0) {
    return undefined;
  }

  const allowedColumns = columnAllowlist[table];
  
  // If no column allowlist is defined for this table, reject all filters for security
  if (!allowedColumns || allowedColumns.size === 0) {
    return 'Filter columns not configured for this table. Contact administrator.';
  }

  // Validate each filter key
  for (const key of Object.keys(filters)) {
    if (!allowedColumns.has(key)) {
      return `Filter column '${key}' is not allowed for this table`;
    }

    const value = filters[key];
    
    // Only allow simple filter values (strings, numbers, booleans, null)
    // Reject objects/arrays which could be used for complex queries
    if (value !== null && typeof value === 'object') {
      return `Complex filter operations are not allowed. Use simple equality filters only.`;
    }
  }

  return undefined;
};

/**
 * Audit log for proxy operations
 */
const auditLog = (
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
  filters: Record<string, unknown> | undefined,
  success: boolean,
  errorMessage?: string,
): void => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    userId,
    userEmail: userEmail ?? 'unknown',
    action,
    table,
    filters: filters ? JSON.stringify(filters) : 'none',
    success,
    errorMessage,
  };
  
  // Log to console (in production, consider sending to a logging service)
  console.log('[AUDIT] Supabase Proxy:', JSON.stringify(logEntry));
};

/**
 * Validates filter keys against allowed columns
 * Returns true if all filter keys are valid
 */
const validateFilterKeys = (
  filters: Record<string, unknown>,
  allowedColumns: Set<string> | undefined,
): { valid: boolean; invalidKeys: string[] } => {
  const filterKeys = Object.keys(filters);
  
  // If no column allowlist is configured, reject filters as a security precaution
  if (!allowedColumns || allowedColumns.size === 0) {
    return { valid: false, invalidKeys: filterKeys };
  }

  const invalidKeys = filterKeys.filter((key) => !allowedColumns.has(key));
  
  return {
    valid: invalidKeys.length === 0,
    invalidKeys,
  };
};

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) ?? [];
    
    // Remove requests outside the time window
    const recentRequests = userRequests.filter((timestamp) => now - timestamp < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      this.requests.set(identifier, recentRequests);
      return false;
    }

    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const identifiers = Array.from(this.requests.keys());
    for (const identifier of identifiers) {
      const timestamps = this.requests.get(identifier);
      if (!timestamps) continue;
      
      const recentRequests = timestamps.filter((timestamp) => now - timestamp < this.windowMs);
      if (recentRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recentRequests);
      }
    }
  }
}

// Global rate limiter instance - 100 requests per minute per user
const rateLimiter = new RateLimiter(60000, 100);

// Cleanup old entries every 5 minutes
setInterval(() => rateLimiter.cleanup(), 300000);

/**
 * Logs proxy operation for audit purposes
 */
const logProxyOperation = (
  userId: string,
  action: ProxyAction,
  table: string,
  filters: Record<string, unknown> | undefined,
  success: boolean,
  error?: string,
): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    table,
    filterKeys: filters ? Object.keys(filters) : [],
    success,
    error,
  };
  
  // Log to console for now - in production, this should go to a logging service
  console.log('AUDIT_LOG:', JSON.stringify(logEntry));
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
    const tableConfig = allowlist[normalizedTable];
    if (!tableConfig || !tableConfig.actions.has(action)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Operation not allowed for this table" }),
      };
    }

    // Validate filter keys against column allowlist
    if (isRecord(filters) && Object.keys(filters).length > 0) {
      const validation = validateFilterKeys(filters, tableConfig.filterableColumns);
      if (!validation.valid) {
        return {
          statusCode: 403,
          body: JSON.stringify({ 
            error: 'Invalid filter columns',
            invalidColumns: validation.invalidKeys,
          }),
        };
      }
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
    // Validate filters against column allowlist
    if (payload.filters && Object.keys(payload.filters).length > 0) {
      const filterValidation = validateFilters(payload.filters, columnAllowlist[normalizedTable], normalizedTable);
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

  let userId: string | undefined;
  let userEmail: string | undefined;

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

    const userId = userData.user.id;

    // Rate limiting check
    if (!rateLimiter.isAllowed(userId)) {
      logProxyOperation(userId, body.action, body.table, body.filters, false, 'Rate limit exceeded');
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      };
    }
    userId = userData.user.id;
    userEmail = userData.user.email;

    const userRoles = new Set<string>([
      ...normalizeRoles(userData.user.app_metadata?.roles),
      ...normalizeRoles(userData.user.user_metadata?.roles),
    ]);

    const allowedRoles = DEFAULT_ALLOWED_ROLES;
    if (allowedRoles.size > 0) {
      const userRolesArray = Array.from(userRoles);
      const hasAllowedRole = userRolesArray.some((role) => allowedRoles.has(role));
      if (!hasAllowedRole) {
        logProxyOperation(userId, body.action, body.table, body.filters, false, 'Insufficient permissions');
      const hasAllowedRole = Array.from(userRoles).some((role) => allowedRoles.has(role));
      if (!hasAllowedRole) {
        logProxyOperation(
          userId,
          userEmail,
          body.action,
          body.table,
          false,
          "Insufficient permissions",
        );
        logProxyOperation(body.action, body.table, userData.user.id, [...userRoles], false, 'User does not have required role');
        auditLog({
          timestamp: new Date().toISOString(),
          userId: userData.user.id,
          userRoles: Array.from(userRoles),
          action: body.action,
          table: body.table,
          filters: body.filters,
          success: false,
          error: 'Forbidden - user does not have required role',
          ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
        });
        auditLog(userId!, userEmail, body.action, body.table, body.filters, false, 'Forbidden: User lacks required role');
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
    // Apply rate limiting
    const rateLimitCheck = checkRateLimit(userData.user.id);
    if (!rateLimitCheck.allowed) {
      logProxyOperation(body.action, body.table, userData.user.id, [...userRoles], false, rateLimitCheck.error);
      return {
        statusCode: 429,
        body: JSON.stringify({ error: rateLimitCheck.error }),
    // Rate limiting check
    const rateLimitResult = checkRateLimit(userData.user.id);
    if (!rateLimitResult.allowed) {
      auditLog({
        timestamp: new Date().toISOString(),
        userId: userData.user.id,
        userRoles: Array.from(userRoles),
        action: body.action,
        table: body.table,
        filters: body.filters,
        success: false,
        error: "Rate limit exceeded",
        ip_address: event.headers["x-forwarded-for"] || event.headers["client-ip"],
        error: 'Rate limit exceeded',
        ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
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
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
    if (checkRateLimit(userId!)) {
      auditLog(userId!, userEmail, body.action, body.table, body.filters, false, 'Rate limit exceeded');
      return {
        statusCode: 429,
        headers: {
          'Retry-After': '60',
        },
        body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      };
    }

    // Validate filter columns if filters are provided
    if (body.filters && Object.keys(body.filters).length > 0) {
      const allowedColumns = columnAllowlist[body.table];
      const filterValidation = validateFilterKeys(body.filters, allowedColumns);
      
      if (!filterValidation.valid) {
        auditLog({
          timestamp: new Date().toISOString(),
          userId: userData.user.id,
          userRoles: Array.from(userRoles),
          action: body.action,
          table: body.table,
          filters: body.filters,
          success: false,
          error: filterValidation.error,
          ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
        });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: filterValidation.error }),
        };
      }
    // Validate filters against column allowlist
    const filterError = validateFilters(body.filters, body.table, columnAllowlist);
    if (filterError) {
      auditLog(userId!, userEmail, body.action, body.table, body.filters, false, filterError);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: filterError }),
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
      logProxyOperation(userId, userEmail, body.action, body.table, false, result.error.message);
      console.error('Supabase proxy error:', result.error);
      logProxyOperation(userId, body.action, body.table, body.filters, false, result.error.message);
      logProxyOperation(body.action, body.table, userData.user.id, [...userRoles], false, result.error.message);
      auditLog({
        timestamp: new Date().toISOString(),
        userId: userData.user.id,
        userRoles: Array.from(userRoles),
        action: body.action,
        table: body.table,
        filters: body.filters,
        success: false,
        error: result.error.message,
        ip_address: event.headers["x-forwarded-for"] || event.headers["client-ip"],
      });
        ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
      });
      auditLog(userId!, userEmail, body.action, body.table, body.filters, false, result.error.message);
      return {
        statusCode: result.status ?? 400,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    // Log successful operation
    logProxyOperation(userId, body.action, body.table, body.filters, true);

    await logProxyOperation({
      timestamp: new Date().toISOString(),
      user_id: userData.user.id,
      user_email: userData.user.email,
    logProxyOperation(userId, userEmail, body.action, body.table, true);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
    // Log successful operation
    logProxyOperation(body.action, body.table, userData.user.id, [...userRoles], true);
    auditLog({
      timestamp: new Date().toISOString(),
      userId: userData.user.id,
      userRoles: Array.from(userRoles),
      action: body.action,
      table: body.table,
      filters: body.filters,
      success: true,
      ip_address: event.headers["x-forwarded-for"] || event.headers["client-ip"],
    });
      ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
    });
    auditLog(userId!, userEmail, body.action, body.table, body.filters, true);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": maxRequestsPerMinute.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.resetAt.toString(),
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      },
      body: JSON.stringify({ data: result.data }),
    };
  } catch (error) {
    console.error("API proxy error:", error);
    // Try to log if we have userId available
    if (error instanceof Error) {
      console.error("[AUDIT] Proxy operation failed:", error.message);
    console.error('API proxy error:', error);
    // Log failed operation if we have user context
    if (body) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
        const { data: userData } = await supabase.auth.getUser(accessToken);
        if (userData?.user) {
          const userRoles = new Set<string>([
            ...normalizeRoles(userData.user.app_metadata?.roles),
            ...normalizeRoles(userData.user.user_metadata?.roles),
          ]);
          logProxyOperation(body.action, body.table, userData.user.id, [...userRoles], false, String(error));
        }
      } catch {
        // Ignore logging errors
      }
    // Try to log the error if we have user data
    if (body && userId) {
      auditLog(userId, userEmail, body.action, body.table, body.filters, false, error instanceof Error ? error.message : 'Unknown error');
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
