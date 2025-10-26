import { describe, expect, it } from "vitest";
import { createAssistantMessage } from "../useAgentChat";

describe("createAssistantMessage", () => {
  it("maps payload fields into assistant message structure", () => {
    const payload: any = {
      content: "Here is your summary",
      metadata: { runs: [] },
      quickReplies: ["Add to cart"],
      extras: { disclaimers: ["Contains nuts"] },
      error: "",
    } as Record<string, unknown>;

    const message = createAssistantMessage(payload);
    expect(message.content).toBe(payload.content);
    expect(message.metadata).toBe(payload.metadata);
    expect(message.quickReplies).toEqual(payload.quickReplies);
    expect(message.extras).toEqual(payload.extras);
    expect(message.error).toBe(payload.error);
  });

  it("handles missing optional fields", () => {
    const payload: any = {
      content: "No metadata provided",
    } as Record<string, unknown>;

    const message = createAssistantMessage(payload);
    expect(message.metadata).toBeUndefined();
    expect(message.quickReplies).toBeUndefined();
    expect(message.extras).toBeUndefined();
    expect(message.error).toBeUndefined();
  });
});
