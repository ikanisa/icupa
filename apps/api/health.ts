/**
 * Health check endpoint
 * Returns service health status
 */

export interface HealthCheckResponse {
  ok: boolean;
  timestamp: string;
  service: string;
  version: string;
  checks: {
    database?: boolean;
    openai?: boolean;
    whatsapp?: boolean;
  };
}

/**
 * Perform health check
 */
export async function healthCheck(): Promise<HealthCheckResponse> {
  const response: HealthCheckResponse = {
    ok: true,
    timestamp: new Date().toISOString(),
    service: "ai-agents",
    version: process.env.npm_package_version || "0.1.0",
    checks: {},
  };

  // Check database (Supabase) connection
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    // Simple query to check connection
    const { error } = await supabase.from("customers").select("count").limit(1);
    response.checks.database = !error;
  } catch {
    response.checks.database = false;
    response.ok = false;
  }

  // Check OpenAI API
  try {
    response.checks.openai = !!process.env.OPENAI_API_KEY;
  } catch {
    response.checks.openai = false;
  }

  // Check WhatsApp configuration
  try {
    response.checks.whatsapp =
      !!process.env.WA_PHONE_NUMBER_ID && !!process.env.WA_ACCESS_TOKEN;
  } catch {
    response.checks.whatsapp = false;
  }

  return response;
}

/**
 * Health handler that can be integrated into any API framework
 */
export async function handleHealthCheck(): Promise<{
  status: number;
  body: HealthCheckResponse;
}> {
  const health = await healthCheck();
  return {
    status: health.ok ? 200 : 503,
    body: health,
  };
}
