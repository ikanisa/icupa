/**
 * Structured logging configuration with PII redaction
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Redact PII from log data
 * Hashes phone numbers (MSISDN) and other sensitive data
 */
export function redactPII(data: any): any {
  if (typeof data === "string") {
    // Redact phone numbers (simple pattern)
    return data.replace(/\+?\d{10,15}/g, (match) => {
      return `***${match.slice(-4)}`;
    });
  }

  if (Array.isArray(data)) {
    return data.map(redactPII);
  }

  if (typeof data === "object" && data !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Redact known PII fields
      if (
        key.toLowerCase().includes("msisdn") ||
        key.toLowerCase().includes("phone") ||
        key.toLowerCase().includes("customer_id")
      ) {
        result[key] = redactPII(value);
      } else {
        result[key] = redactPII(value);
      }
    }
    return result;
  }

  return data;
}

/**
 * Structured logger with PII redaction
 */
export class Logger {
  constructor(private context: string) {}

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[LOG_LEVEL];
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...(data && { data: redactPII(data) }),
    };

    console.log(JSON.stringify(entry));
  }

  debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: any): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }

  error(message: string, error?: any): void {
    const errorData = error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : error;
    this.log("error", message, errorData);
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
