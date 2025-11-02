export class DataAccessError extends Error {
  context?: Record<string, unknown>;

  constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message, { cause: options?.cause });
    this.name = "DataAccessError";
    this.context = options?.context;
  }
}
