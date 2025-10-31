/**
 * Structured logging utility for voice agent
 */

export interface LogContext {
  [key: string]: unknown;
}

export function log(msg: string, ctx: LogContext = {}): void {
  const logEntry = {
    ts: new Date().toISOString(),
    msg,
    ...ctx,
  };
  console.log(JSON.stringify(logEntry));
}

export function logError(msg: string, error: unknown, ctx: LogContext = {}): void {
  const errorInfo =
    error instanceof Error
      ? { error: error.message, stack: error.stack }
      : { error: String(error) };
  
  log(msg, { level: 'error', ...errorInfo, ...ctx });
}

/**
 * Exponential backoff helper
 */
export async function backoff(attempt: number): Promise<void> {
  const delay = Math.min(5000, 100 * 2 ** attempt);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Generate a unique request/session ID
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
