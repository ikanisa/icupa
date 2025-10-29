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

      case "number":
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) {
          return { ok: false, error: `Parameter '${param.name}' must be a number` };
        }
        return { ok: true, value: num };

      case "date":
        // Validate ISO 8601 date format (YYYY-MM-DD)
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { ok: false, error: `Parameter '${param.name}' must be a valid date (YYYY-MM-DD)` };
        }
        return { ok: true, value };

      case "timestamp":
        // Validate ISO 8601 timestamp
        if (typeof value !== "string") {
          return { ok: false, error: `Parameter '${param.name}' must be a valid timestamp` };
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { ok: false, error: `Parameter '${param.name}' must be a valid timestamp` };
        }
        return { ok: true, value };

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
function prepareSqlWithParams(sql: string, params: Record<string, any>): { sql: string; values: any[] } {
  const values: any[] = [];
  let index = 1;
  const paramMap: Record<string, number> = {};

  const preparedSql = sql.replace(/:(\w+)/g, (_, paramName) => {
    if (!(paramName in paramMap)) {
      paramMap[paramName] = index++;
      values.push(params[paramName]);
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
  toolManifests: Record<string, z.infer<typeof ToolManifestSchema>>,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
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
  let manifest: z.infer<typeof ToolManifestSchema> | undefined;
  let tool: Tool | undefined;

  for (const [, manifestData] of Object.entries(toolManifests)) {
    tool = manifestData.tools.find((t) => t.name === toolName);
    if (tool) {
      manifest = manifestData;
      break;
    }
  }

  if (!manifest || !tool) {
    await logAudit(supabaseUrl, supabaseServiceRoleKey, {
      role,
      toolName,
      operation: "execute",
      resource: "unknown",
      params,
      ok: false,
      error: `Tool '${toolName}' not found`,
    });
    return { ok: false, error: `Tool '${toolName}' not found` };
  }

  // Validate parameters
  const validatedParams: Record<string, any> = {};
  for (const paramDef of tool.parameters) {
    const validation = validateAndConvertParam(params[paramDef.name], paramDef);
    if (!validation.ok) {
      await logAudit(supabaseUrl, supabaseServiceRoleKey, {
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

  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // Set RLS context if provided
    if (rls_context) {
      for (const [key, value] of Object.entries(rls_context)) {
        await supabase.rpc("set_config", {
          setting_name: key,
          setting_value: value,
          is_local: true,
        });
      }
    }

    // Prepare SQL with parameters
    const { sql: preparedSql, values } = prepareSqlWithParams(tool.sql, validatedParams);

    // Execute SQL via Supabase
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: preparedSql,
      params: values,
    });

    if (error) {
      await logAudit(supabaseUrl, supabaseServiceRoleKey, {
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
    await logAudit(supabaseUrl, supabaseServiceRoleKey, {
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
    await logAudit(supabaseUrl, supabaseServiceRoleKey, {
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
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
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
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
