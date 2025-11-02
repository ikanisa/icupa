import { ZodTypeAny } from "zod";
import type { SandboxExecutionContext } from "../sandbox/types";
import { redactPii } from "../logging/redactor";

export interface ToolExecutionContext extends SandboxExecutionContext {
  /**
   * Emits an audit log event with PII redaction applied automatically.
   */
  audit: (message: string, details?: Record<string, unknown>) => void;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  execute: (input: unknown, context: ToolExecutionContext) => Promise<unknown>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(toolName: string): AgentTool | undefined {
    return this.tools.get(toolName);
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  async invoke(
    toolName: string,
    input: unknown,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} is not registered`);
    }

    const parsedInput = tool.inputSchema.parse(input);
    context.audit(`tool.invoked`, {
      tool: toolName,
      input: redactPii(parsedInput),
    });

    const output = await tool.execute(parsedInput, context);

    if (tool.outputSchema) {
      const parsedOutput = tool.outputSchema.parse(output);
      context.audit(`tool.completed`, {
        tool: toolName,
        output: redactPii(parsedOutput),
      });
      return parsedOutput;
    }

    context.audit(`tool.completed`, {
      tool: toolName,
      output: redactPii(output),
    });
    return output;
  }
}
