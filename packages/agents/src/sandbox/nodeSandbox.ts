import vm from "node:vm";
import { performance } from "node:perf_hooks";
import type {
  SandboxExecutionContext,
  SandboxExecutionRequest,
  SandboxExecutionResult,
  SandboxRunner,
} from "./types";

export class NodeSandboxRunner implements SandboxRunner {
  constructor(private readonly globalScope: Record<string, unknown> = {}) {}

  async execute(
    request: SandboxExecutionRequest,
    context: SandboxExecutionContext
  ): Promise<SandboxExecutionResult> {
    const logs: string[] = [];
    const startedAt = new Date();
    const sandboxConsole = {
      log: (...args: unknown[]) => {
        const message = args.map((arg) => String(arg)).join(" ");
        logs.push(message);
        context.logger.info(message);
      },
    };

    const script = new vm.Script(`(async () => { ${request.code} })()`);
    const vmContext = vm.createContext({
      console: sandboxConsole,
      input: request.input,
      tools: request.tools,
      ...this.globalScope,
    });

    const controller = new AbortController();
    const timeout = request.timeoutMs ?? 10_000;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const startMs = performance.now();
      const output = await Promise.race([
        script.runInContext(vmContext, { timeout }),
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new Error(`Sandbox execution timed out after ${timeout}ms`));
          });
        }),
      ]);
      const duration = performance.now() - startMs;
      context.logger.info("sandbox.completed", {
        taskId: context.taskId,
        runId: context.runId,
        durationMs: Math.round(duration),
      });
      return {
        output,
        logs,
        startedAt,
        completedAt: new Date(),
      } satisfies SandboxExecutionResult;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
