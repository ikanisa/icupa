import type { AgentRunService } from "./service";

type JsonLike = Record<string, unknown> | unknown[] | string | number | boolean | null;

const JSONScalar = {
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value: JsonLike) => value,
  parseValue: (value: JsonLike) => value,
  parseLiteral: (ast: any) => ("value" in ast ? ast.value : null),
};

export function createGraphqlModule(service: AgentRunService) {
  const typeDefs = /* GraphQL */ `
    scalar JSON

    type Tool {
      name: String!
      description: String!
    }

    type AgentRun {
      id: ID!
      agentId: String!
      status: String!
      createdAt: String!
      updatedAt: String!
      completedAt: String
      finalOutput: JSON
      metadata: JSON
    }

    type Query {
      agentRuns(projectId: String!): [AgentRun!]!
      agentRun(id: ID!): AgentRun
      availableTools: [Tool!]!
    }

    input CreateAgentRunInput {
      agentId: String!
      projectId: String!
      domain: String!
      input: JSON
    }

    type Mutation {
      createAgentRun(input: CreateAgentRunInput!): AgentRun!
      finalizeAgentRun(runId: ID!, domain: String!, output: JSON): AgentRun!
    }
  `;

  const resolvers = {
    JSON: JSONScalar,
    Query: {
      agentRuns: (_: unknown, args: { projectId: string }) => service.listRuns(args.projectId),
      agentRun: (_: unknown, args: { id: string }) => service.getRun(args.id),
      availableTools: () => service.tools,
    },
    Mutation: {
      createAgentRun: (_: unknown, args: { input: { agentId: string; projectId: string; domain: any; input: unknown } }) =>
        service.createRun(args.input),
      finalizeAgentRun: (_: unknown, args: { runId: string; domain: string; output: unknown }) =>
        service.finalizeRun(args.runId, args.output, args.domain),
    },
  };

  return { typeDefs, resolvers } as const;
}
