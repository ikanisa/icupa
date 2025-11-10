import type { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

type ProxyAction = 'select' | 'insert' | 'update' | 'delete';

type Allowlist = Record<string, Set<ProxyAction>>;

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

const DEFAULT_ALLOWED_ROLES = new Set(
  (process.env.SUPABASE_PROXY_ALLOWED_ROLES ?? 'ops,admin')
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean),
);

const parseAllowlist = (rawConfig: string | undefined): AllowlistConfig => {
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    return Object.entries(parsed).reduce<AllowlistConfig>((acc, [table, config]) => {
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
        .map((action) => (typeof action === 'string' ? action.trim().toLowerCase() : ''))
        .filter((action): action is ProxyAction => action === 'select' || action === 'insert' || action === 'update' || action === 'delete');

      if (allowedActions.length > 0) {
        acc[normalizedTable] = {
          actions: new Set(allowedActions),
          filterableColumns: filterableColumns ? new Set(filterableColumns) : undefined,
        };
      }

      return acc;
    }, {});
  } catch (error) {
    console.error('Failed to parse SUPABASE_PROXY_TABLE_ALLOWLIST:', error);
    return {};
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeRoles = (roles: unknown): string[] => {
  if (Array.isArray(roles)) {
    return roles
      .map((role) => (typeof role === 'string' ? role.toLowerCase() : ''))
      .filter(Boolean);
  }

  if (typeof roles === 'string') {
    return [roles.toLowerCase()].filter(Boolean);
  }

  return [];
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
 */
export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowlist = parseAllowlist(process.env.SUPABASE_PROXY_TABLE_ALLOWLIST);

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase configuration missing' }),
    };
  }

  if (Object.keys(allowlist).length === 0) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Proxy is disabled. Configure SUPABASE_PROXY_TABLE_ALLOWLIST.' }),
    };
  }

  const authorizationHeader = event.headers.authorization ?? event.headers.Authorization;
  if (!authorizationHeader || !authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing or invalid Authorization header' }),
    };
  }

  const accessToken = authorizationHeader.slice(7).trim();
  if (!accessToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid access token' }),
    };
  }

  let body: ProxyRequestBody;
  try {
    const parsed = JSON.parse(event.body || '{}');
    const { action, table, columns, data, filters } = parsed as ProxyRequestBody;

    if (action !== 'select' && action !== 'insert' && action !== 'update' && action !== 'delete') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or missing action' }),
      };
    }

    if (typeof table !== 'string' || !table.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or missing table' }),
      };
    }

    const normalizedTable = table.trim();
    const tableConfig = allowlist[normalizedTable];
    if (!tableConfig || !tableConfig.actions.has(action)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Operation not allowed for this table' }),
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

    if (typeof columns === 'string' && columns.trim()) {
      payload.columns = columns.trim();
    }

    if (action === 'select') {
      if (typeof data === 'string' && data.trim() && !payload.columns) {
        payload.columns = data.trim();
      }
    } else if (action === 'insert' || action === 'update') {
      if (Array.isArray(data)) {
        const sanitized = data.filter(isRecord);
        if (sanitized.length !== data.length || sanitized.length === 0) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid data payload' }),
          };
        }
        payload.data = sanitized;
      } else if (isRecord(data)) {
        payload.data = data;
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid data payload' }),
        };
      }
    }

    if ((action === 'update' || action === 'delete') && (!payload.filters || Object.keys(payload.filters).length === 0)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Filters required for update and delete operations' }),
      };
    }

    body = payload;
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
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
        body: JSON.stringify({ error: 'Unauthorized' }),
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
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
        };
      }
    }

    const tableQuery = supabase.from(body.table);
    let result;

    switch (body.action) {
      case 'select': {
        const columns = body.columns ?? '*';
        let query = tableQuery.select(columns);
        if (body.filters) {
          query = query.match(body.filters);
        }
        result = await query;
        break;
      }
      case 'insert': {
        result = await tableQuery.insert(body.data as Record<string, unknown> | Record<string, unknown>[]);
        break;
      }
      case 'update': {
        result = await tableQuery.update(body.data as Record<string, unknown> | Record<string, unknown>[]).match(body.filters!);
        break;
      }
      case 'delete': {
        result = await tableQuery.delete().match(body.filters!);
        break;
      }
      default: {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unsupported action' }),
        };
      }
    }

    if (result.error) {
      console.error('Supabase proxy error:', result.error);
      logProxyOperation(userId, body.action, body.table, body.filters, false, result.error.message);
      return {
        statusCode: result.status ?? 400,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    // Log successful operation
    logProxyOperation(userId, body.action, body.table, body.filters, true);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: result.data }),
    };
  } catch (error) {
    console.error('API proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
