import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

/**
 * Health check endpoint for monitoring
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();

  // Check environment configuration
  const envChecks = {
    supabaseUrl: !!process.env.VITE_SUPABASE_URL,
    supabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    nodeVersion: process.version,
  };

  const healthy = envChecks.supabaseUrl && envChecks.supabaseKey;
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
    }),
  };
};
