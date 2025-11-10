import type { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

type ProxyAction = "select" | "insert" | "update" | "delete";

type Allowlist = Record<string, Set<ProxyAction>>;

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
      return {
        statusCode: result.status ?? 400,
        body: JSON.stringify({ error: result.error.message }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
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
