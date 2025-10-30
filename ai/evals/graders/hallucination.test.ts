import { describe, it, expect } from "vitest";
import { gradeHallucination } from "./hallucination";

describe("gradeHallucination", () => {
  it("should return high score for uncertain responses", () => {
    const score = gradeHallucination(
      "Let me check that information for you.",
      [{ role: "user", content: "What is the status?" }]
    );
    expect(score).toBeGreaterThan(0.9);
  });

  it("should return lower score for definitive claims without tools", () => {
    const score = gradeHallucination(
      "According to my records, the customer has 5 vouchers.",
      [{ role: "user", content: "How many vouchers?" }]
    );
    expect(score).toBeLessThan(0.5);
  });

  it("should return high score for claims with tool calls", () => {
    const score = gradeHallucination(
      "According to my database, the customer exists.",
      [
        { role: "user", content: "Check customer" },
        { role: "tool", content: '{"exists": true}' },
      ]
    );
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it("should handle ground truth comparison", () => {
    const score = gradeHallucination(
      "The customer name is John Doe",
      [{ role: "user", content: "What is the name?" }],
      "The customer name is John Doe"
    );
    expect(score).toBeGreaterThan(0.5);
  });
});
