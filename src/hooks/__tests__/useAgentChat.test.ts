import { describe, expect, it } from "vitest";
import { mergePrompts, normaliseQuickReplies } from "../useAgentChat";

describe("normaliseQuickReplies", () => {
  it("filters to non-empty trimmed strings", () => {
    const result = normaliseQuickReplies(["Hello ", "  ", null, undefined, "world", 123 as unknown as string]);
    expect(result).toEqual(["Hello", "world"]);
  });

  it("returns empty array for falsy input", () => {
    expect(normaliseQuickReplies(undefined)).toEqual([]);
    expect(normaliseQuickReplies([])).toEqual([]);
  });
});

describe("mergePrompts", () => {
  it("appends unique prompts preserving order", () => {
    const current = ["hello", "world"];
    const incoming = ["World", "Add more", "hello", "Another"];
    expect(mergePrompts(current, incoming)).toEqual(["hello", "world", "Add more", "Another"]);
  });

  it("returns current array if incoming empty", () => {
    const current = ["hello"];
    expect(mergePrompts(current, undefined)).toBe(current);
    expect(mergePrompts(current, [])).toBe(current);
  });
});
