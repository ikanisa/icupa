import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Health check endpoint for admin monitoring
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();

  // Check environment configuration
  const envChecks = {
    supabaseUrl: !!process.env.VITE_SUPABASE_URL,
    supabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeVersion: process.version,
  };

  const healthy = envChecks.supabaseUrl && envChecks.supabaseKey && envChecks.supabaseServiceKey;
  const responseTime = Date.now() - startTime;

  return {
    statusCode: healthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      environment: {
        node: process.version,
        configured: envChecks,
      },
      app: 'icupa-admin',
    }),
  };
};
