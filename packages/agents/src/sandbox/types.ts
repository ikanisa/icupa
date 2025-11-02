export interface SandboxExecutionContext {
  runId: string;
  taskId: string;
  metadata?: Record<string, unknown>;
  logger: {
    info: (message: string, details?: Record<string, unknown>) => void;
    warn: (message: string, details?: Record<string, unknown>) => void;
    error: (message: string, details?: Record<string, unknown>) => void;
  };
}

export interface SandboxExecutionRequest {
  code: string;
  input: unknown;
  timeoutMs?: number;
  tools?: string[];
}

export interface SandboxExecutionResult {
  output: unknown;
  logs: string[];
  startedAt: Date;
  completedAt: Date;
}

export interface SandboxRunner {
  execute(
    request: SandboxExecutionRequest,
    context: SandboxExecutionContext
  ): Promise<SandboxExecutionResult>;
}
