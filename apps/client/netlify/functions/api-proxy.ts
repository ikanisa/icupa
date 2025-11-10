import type { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

type ProxyAction = 'select' | 'insert' | 'update' | 'delete';

type Allowlist = Record<string, Set<ProxyAction>>;

type ColumnAllowlist = Record<string, Set<string>>;

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'cs' | 'cd';

type ProxyRequestBody = {
  action: ProxyAction;
  table: string;
  columns?: string;
  data?: unknown;
  filters?: Record<string, unknown>;
};

type AuditLogEntry = {
  timestamp: string;
  userId: string;
  userRoles: string[];
  action: ProxyAction;
  table: string;
  filters?: Record<string, unknown>;
  success: boolean;
  error?: string;
  ipAddress?: string;
};

const DEFAULT_ALLOWED_ROLES = new Set(
  (process.env.SUPABASE_PROXY_ALLOWED_ROLES ?? 'ops,admin')
    .split(',')
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
        .map((action) => (typeof action === 'string' ? action.trim().toLowerCase() : ''))
        .filter((action): action is ProxyAction => action === 'select' || action === 'insert' || action === 'update' || action === 'delete');

      if (allowedActions.length > 0) {
        acc[normalizedTable] = new Set(allowedActions);
      }

      return acc;
    }, {});
  } catch (error) {
    console.error('Failed to parse SUPABASE_PROXY_TABLE_ALLOWLIST:', error);
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
        .map((col) => (typeof col === 'string' ? col.trim() : ''))
        .filter(Boolean);

      if (allowedColumns.length > 0) {
        acc[normalizedTable] = new Set(allowedColumns);
      }

      return acc;
    }, {});
  } catch (error) {
    console.error('Failed to parse SUPABASE_PROXY_COLUMN_ALLOWLIST:', error);
    return {};
  }
};

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
  const columnAllowlist = parseColumnAllowlist(process.env.SUPABASE_PROXY_COLUMN_ALLOWLIST);

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
    const allowedActions = allowlist[normalizedTable];
    if (!allowedActions || !allowedActions.has(action)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Operation not allowed for this table' }),
      };
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

    const userRoles = new Set<string>([
      ...normalizeRoles(userData.user.app_metadata?.roles),
      ...normalizeRoles(userData.user.user_metadata?.roles),
    ]);

    const allowedRoles = DEFAULT_ALLOWED_ROLES;
    if (allowedRoles.size > 0) {
      const hasAllowedRole = Array.from(userRoles).some((role) => allowedRoles.has(role));
      if (!hasAllowedRole) {
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
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
        };
      }
    }

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
        error: 'Rate limit exceeded',
        ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
      });
      return {
        statusCode: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
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
      auditLog({
        timestamp: new Date().toISOString(),
        userId: userData.user.id,
        userRoles: Array.from(userRoles),
        action: body.action,
        table: body.table,
        filters: body.filters,
        success: false,
        error: result.error.message,
        ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
      });
      return {
        statusCode: result.status ?? 400,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    // Log successful operation
    auditLog({
      timestamp: new Date().toISOString(),
      userId: userData.user.id,
      userRoles: Array.from(userRoles),
      action: body.action,
      table: body.table,
      filters: body.filters,
      success: true,
      ipAddress: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
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
