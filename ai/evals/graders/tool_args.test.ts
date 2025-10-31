import { describe, it, expect, vi } from "vitest";
import { gradeToolArgs, validateToolArgs } from "./tool_args";

describe("gradeToolArgs", () => {
  it("should return 1 when no tools are expected", () => {
    const score = gradeToolArgs([], {});
    expect(score).toBe(1);
  });

  it("should return 0 when wrong tools are called", () => {
    const score = gradeToolArgs(
      [{ name: "wrong_tool", arguments: {} }],
      { expected_tools: ["create_voucher"] }
    );
    expect(score).toBe(0);
  });

  it("should return 1 when correct tools are called with no args check", () => {
    const score = gradeToolArgs(
      [{ name: "create_voucher", arguments: { amount: 5000 } }],
      { expected_tools: ["create_voucher"] }
    );
    expect(score).toBe(1);
  });

  it("should return 1 when args match exactly", () => {
    const score = gradeToolArgs(
      [{ name: "create_voucher", arguments: { amount: 5000, currency: "RWF" } }],
      {
        expected_tools: ["create_voucher"],
        expected_args: { amount: 5000, currency: "RWF" },
      }
    );
    expect(score).toBe(1);
  });

  it("should return partial score when some args match", () => {
    const score = gradeToolArgs(
      [{ name: "create_voucher", arguments: { amount: 5000, currency: "USD" } }],
      {
        expected_tools: ["create_voucher"],
        expected_args: { amount: 5000, currency: "RWF" },
      }
    );
    expect(score).toBe(0.5);
  });
});

describe("validateToolArgs", () => {
  it("should validate create_voucher args", () => {
    expect(
      validateToolArgs({
        name: "create_voucher",
        arguments: { customer_msisdn: "+250788123456", amount: 5000 },
      })
    ).toBe(true);

    expect(
      validateToolArgs({
        name: "create_voucher",
        arguments: { customer_msisdn: "+250788123456", amount: -5000 },
      })
    ).toBe(false);
  });

  it("should validate lookup_customer args", () => {
    expect(
      validateToolArgs({
        name: "lookup_customer",
        arguments: { msisdn: "+250788123456" },
      })
    ).toBe(true);

    expect(
      validateToolArgs({
        name: "lookup_customer",
        arguments: {},
      })
    ).toBe(false);
  });

  it("should validate redeem_voucher args", () => {
    expect(
      validateToolArgs({
        name: "redeem_voucher",
        arguments: { voucher_id: "test-123" },
      })
    ).toBe(true);
  });
});
