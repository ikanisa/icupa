import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Tool parameter schema
 */
const ToolParameterSchema = z.object({
  name: z.string(),
  type: z.enum(["uuid", "string", "number", "date", "timestamp", "jsonb"]),
  required: z.boolean(),
});

/**
 * Tool definition schema
 */
const ToolSchema = z.object({
  name: z.string(),
  type: z.literal("sql"),
  description: z.string(),
  sql: z.string(),
  parameters: z.array(ToolParameterSchema),
});

/**
 * Tool manifest schema
 */
const ToolManifestSchema = z.object({
  name: z.string(),
  description: z.string(),
  tools: z.array(ToolSchema),
});

/**
 * Execute tool request schema
 */
const ExecuteToolRequestSchema = z.object({
  role: z.enum(["waiter_agent", "cfo_agent", "legal_agent"]),
  toolName: z.string(),
  params: z.record(z.any()),
  rls_context: z.record(z.string()).optional(),
});

type ExecuteToolRequest = z.infer<typeof ExecuteToolRequestSchema>;
type Tool = z.infer<typeof ToolSchema>;
type ToolParameter = z.infer<typeof ToolParameterSchema>;
type AgentRole = ExecuteToolRequest["role"];

interface PreparedParam {
  type: ToolParameter["type"];
  value: any;
}

interface ExecuteToolSupabaseConfig {
  supabaseUrl: string;
  roleKeys: Record<AgentRole, string>;
  auditKey?: string;
}

/**
 * Result of tool execution
 */
interface ToolExecutionResult {
  ok: boolean;
  data?: any;
  error?: string;
}

/**
 * Validate and convert parameter value based on type
 */
function validateAndConvertParam(
  value: any,
  param: ToolParameter,
): { ok: boolean; value?: any; error?: string } {
  if (param.required && (value === undefined || value === null)) {
    return { ok: false, error: `Required parameter '${param.name}' is missing` };
  }

  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  try {
    switch (param.type) {
      case "uuid":
        // Validate UUID format
        if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          return { ok: false, error: `Parameter '${param.name}' must be a valid UUID` };
        }
        return { ok: true, value };

      case "string":
        if (typeof value !== "string") {
          return { ok: false, error: `Parameter '${param.name}' must be a string` };
        }
        return { ok: true, value };

      case "number": {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) {
          return { ok: false, error: `Parameter '${param.name}' must be a number` };
        }
        return { ok: true, value: num };
      }

      case "date":
        // Validate ISO 8601 date format (YYYY-MM-DD)
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { ok: false, error: `Parameter '${param.name}' must be a valid date (YYYY-MM-DD)` };
        }
        return { ok: true, value };

      case "timestamp": {
        // Validate ISO 8601 timestamp
        if (typeof value !== "string") {
          return { ok: false, error: `Parameter '${param.name}' must be a valid timestamp` };
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { ok: false, error: `Parameter '${param.name}' must be a valid timestamp` };
        }
        return { ok: true, value };
      }

      case "jsonb":
        // Ensure it's a valid JSON object or array
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return { ok: true, value: parsed };
          } catch {
            return { ok: false, error: `Parameter '${param.name}' must be valid JSON` };
          }
        }
        if (typeof value === "object") {
          return { ok: true, value };
        }
        return { ok: false, error: `Parameter '${param.name}' must be a JSON object or array` };

      default:
        return { ok: false, error: `Unknown parameter type '${param.type}'` };
    }
  } catch (err) {
    return { ok: false, error: `Error validating parameter '${param.name}': ${err}` };
  }
}

/**
 * Replace SQL placeholders with positional parameters
 */
function createSupabaseClientWithKey(
  supabaseUrl: string,
  key: string,
): SupabaseClient {
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false },
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  });
}

function createAuditClient(
  config: ExecuteToolSupabaseConfig,
  role: AgentRole,
): SupabaseClient | null {
  const auditKey = config.auditKey ?? config.roleKeys[role];
  if (!auditKey) {
    return null;
  }
  return createSupabaseClientWithKey(config.supabaseUrl, auditKey);
}

function prepareSqlWithParams(
  sql: string,
  params: Record<string, any>,
  paramDefs: ToolParameter[],
): { sql: string; values: PreparedParam[] } {
  const values: PreparedParam[] = [];
  let index = 1;
  const paramMap: Record<string, number> = {};
  const paramDefMap = Object.fromEntries(
    paramDefs.map((definition) => [definition.name, definition]),
  );

  const preparedSql = sql.replace(/:(\w+)/g, (_, paramName) => {
    if (!(paramName in paramDefMap)) {
      throw new Error(`Parameter '${paramName}' is not defined in tool manifest`);
    }
    if (!(paramName in paramMap)) {
      paramMap[paramName] = index++;
      values.push({
        type: paramDefMap[paramName].type,
        value: params[paramName],
      });
    }
    return `$${paramMap[paramName]}`;
  });

  return { sql: preparedSql, values };
}

/**
 * Execute a tool via Supabase with RLS context
 */
export async function executeTool(
  request: ExecuteToolRequest,
  toolManifests: Record<AgentRole, z.infer<typeof ToolManifestSchema>>,
  supabaseConfig: ExecuteToolSupabaseConfig,
): Promise<ToolExecutionResult> {
  // Validate request
  const requestValidation = ExecuteToolRequestSchema.safeParse(request);
  if (!requestValidation.success) {
    return {
      ok: false,
      error: `Invalid request: ${requestValidation.error.message}`,
    };
  }

  const { role, toolName, params, rls_context } = requestValidation.data;

  // Find tool manifest for the role
  const manifest = toolManifests[role];
  let auditClient = createAuditClient(supabaseConfig, role);

  if (!manifest) {
    await logAudit(auditClient, {
      role,
      toolName,
      operation: "execute",
      resource: "unknown",
      params,
      ok: false,
      error: `No manifest configured for role '${role}'`,
    });
    return { ok: false, error: `No manifest configured for role '${role}'` };
  }

  const tool = manifest.tools.find((t) => t.name === toolName);

  if (!tool) {
    await logAudit(auditClient, {
      role,
      toolName,
      operation: "execute",
      resource: "unknown",
      params,
      ok: false,
      error: `Tool '${toolName}' not found for role '${role}'`,
    });
    return { ok: false, error: `Tool '${toolName}' not found` };
  }

  // Validate parameters
  const validatedParams: Record<string, any> = {};
  for (const paramDef of tool.parameters) {
    const validation = validateAndConvertParam(params[paramDef.name], paramDef);
    if (!validation.ok) {
      await logAudit(auditClient, {
        role,
        toolName,
        operation: "execute",
        resource: tool.sql.split(" ")[0], // First word (select/insert/update)
        params,
        ok: false,
        error: validation.error,
      });
      return { ok: false, error: validation.error };
    }
    validatedParams[paramDef.name] = validation.value;
  }

  const roleKey = supabaseConfig.roleKeys[role];
  if (!roleKey) {
    await logAudit(auditClient, {
      role,
      toolName,
      operation: "execute",
      resource: tool.sql.split(" ")[0],
      params: validatedParams,
      ok: false,
      error: `No Supabase key configured for role '${role}'`,
    });
    return { ok: false, error: `No Supabase key configured for role '${role}'` };
  }

  const supabase = createSupabaseClientWithKey(
    supabaseConfig.supabaseUrl,
    roleKey,
  );

  if (!auditClient) {
    auditClient = supabase;
  }

  try {
    // Prepare SQL with parameters
    const { sql: preparedSql, values } = prepareSqlWithParams(
      tool.sql,
      validatedParams,
      tool.parameters,
    );

    // Execute SQL via Supabase
    const { data, error } = await supabase.rpc("mcp_execute_tool", {
      role,
      sql: preparedSql,
      params: values,
      rls_context: rls_context ?? {},
    });

    if (error) {
      await logAudit(auditClient, {
        role,
        toolName,
        operation: "execute",
        resource: tool.sql.split(" ")[0],
        params: validatedParams,
        ok: false,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    // Log success
    await logAudit(auditClient, {
      role,
      toolName,
      operation: "execute",
      resource: tool.sql.split(" ")[0],
      params: validatedParams,
      ok: true,
    });

    return { ok: true, data };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    await logAudit(auditClient, {
      role,
      toolName,
      operation: "execute",
      resource: tool.sql.split(" ")[0],
      params: validatedParams,
      ok: false,
      error: errorMsg,
    });
    return { ok: false, error: errorMsg };
  }
}

/**
 * Log audit entry to mcp_audit_log
 */
async function logAudit(
  supabase: SupabaseClient | null,
  entry: {
    role: string;
    toolName: string;
    operation: string;
    resource: string;
    params: any;
    ok: boolean;
    error?: string;
  },
): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    await supabase.from("mcp_audit_log").insert({
      role: entry.role,
      tool: entry.toolName,
      operation: entry.operation,
      resource: entry.resource,
      params: entry.params,
      ok: entry.ok,
      error: entry.error || null,
    });
  } catch (error) {
    console.error("Failed to log audit entry:", error);
  }
}

/**
 * Load tool manifest from JSON
 */
export function loadToolManifest(manifestJson: any): z.infer<typeof ToolManifestSchema> {
  return ToolManifestSchema.parse(manifestJson);
}
