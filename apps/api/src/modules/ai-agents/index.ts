import { AuditTrail, ToolRegistry } from "@icupa/agents";
import { createGraphqlModule } from "./graphql";
import { createRestHandlers } from "./rest";
import { AgentRunRepository, type AgentRunRepositoryPort } from "./repository";
import { AgentRunService } from "./service";
import { createWebhookHandler } from "./webhooks";

export interface AiAgentsModuleOptions {
  repository?: AgentRunRepositoryPort;
  toolRegistry?: ToolRegistry;
  auditTrail?: AuditTrail;
}

export function createAiAgentsModule(options: AiAgentsModuleOptions = {}) {
  const repository = options.repository ?? new AgentRunRepository();
  const toolRegistry = options.toolRegistry ?? new ToolRegistry();
  const auditTrail = options.auditTrail ?? new AuditTrail();
  const service = new AgentRunService({ repository, toolRegistry, auditTrail });

  return {
    service,
    rest: createRestHandlers(service),
    graphql: createGraphqlModule(service),
    webhook: createWebhookHandler(service),
    auditTrail,
    toolRegistry,
  } as const;
}

export type { AgentRunService } from "./service";
export { AgentRunRepository } from "./repository";
