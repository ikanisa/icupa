import { describe, expect, it } from "vitest";
import {
  createMetadataCollector,
  extractAgentRunMetadata,
} from "../agent-metadata";

describe("extractAgentRunMetadata", () => {
  const makeResult = (state: Record<string, unknown>) => ({
    state: {
      toJSON: () => state,
    },
  });

  it("coalesces tool traces and suggested prompts", () => {
    const result = makeResult({
      toolCalls: [
        {
          id: "trace-1",
          toolName: "get_menu",
          status: "success",
          arguments: { tenant: "demo" },
          result: { ok: true },
        },
        {
          id: "trace-1",
          toolName: "get_menu",
          status: "success",
        },
      ],
      suggestedActions: ["See specials"],
    });

    const metadata = extractAgentRunMetadata("waiter", result, {
      usage: { inputTokens: 10, outputTokens: 5 },
      model: "gpt-4o",
      costUsd: 0.02,
      fallbackSuggestedPrompts: ["Add appetizers"],
    });

    expect(metadata.agent_type).toBe("waiter");
    expect(metadata.tool_traces).toHaveLength(1);
    expect(metadata.tool_traces[0]?.tool).toBe("get_menu");
    expect(metadata.tool_traces[0]?.status).toBe("succeeded");
    expect(metadata.suggested_prompts).toHaveLength(2);
    expect(metadata.suggested_prompts.map((prompt) => prompt.prompt)).toEqual([
      "See specials",
      "Add appetizers",
    ]);
  });
});

describe("createMetadataCollector", () => {
  it("aggregates runs and builds combined metadata", () => {
    const collector = createMetadataCollector();
    const result = {
      state: {
        toJSON: () => ({
          suggestedActions: ["Share wine pairings"],
        }),
      },
    };

    collector.addRun("waiter", result, { fallbackSuggestedPrompts: ["Suggest dessert"] });
    collector.addRun("upsell", result, {});

    expect(collector.runs).toHaveLength(2);
    const response = collector.build();
    expect(response.runs).toHaveLength(2);
    expect(response.suggested_prompts.map((prompt) => prompt.prompt)).toEqual([
      "Share wine pairings",
      "Suggest dessert",
      "Share wine pairings",
    ]);
  });
});
