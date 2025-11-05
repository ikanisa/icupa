import pino from 'pino';
import pinoHttp from 'pino-http';
import type { AuditLogger } from '../../modules/shared/ports.js';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization'],
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

export const httpLogger = pinoHttp({
  logger,
  customProps: () => ({ service: 'api' })
});

export class PinoAuditLogger implements AuditLogger {
  constructor(private readonly baseLogger = logger) {}

  record(event: string, payload: Record<string, unknown>) {
    this.baseLogger.info({ event, payload, audit: true }, 'audit');
  }
}
