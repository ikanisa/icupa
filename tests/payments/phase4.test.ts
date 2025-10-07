import { describe, expect, it } from "vitest";
import {
  DEFAULT_FAILURE_MESSAGE,
  deriveFailureMessage,
  getPendingCopy,
  mapProviderToUiMethod,
  normalisePaymentStatus,
  resolveUiStatus,
} from "@/lib/payment-utils";

describe.sequential("Phase 4 payment coverage", () => {
  it("maps provider identifiers to UI payment methods", () => {
    expect(mapProviderToUiMethod("stripe")).toBe("card");
    expect(mapProviderToUiMethod("MTN_MOMO")).toBe("momo");
    expect(mapProviderToUiMethod("airtel_money")).toBe("airtel");
    expect(mapProviderToUiMethod("unknown" as string)).toBe("card");
  });

  it("normalises provider statuses and resolves UI state", () => {
    expect(normalisePaymentStatus("Captured")).toBe("captured");
    expect(resolveUiStatus("captured")).toBe("succeeded");
    expect(resolveUiStatus("FAILED")).toBe("error");
    expect(resolveUiStatus("processing")).toBe("pending");
  });

  it("derives the correct failure messaging", () => {
    expect(
      deriveFailureMessage({
        status: "failed",
        failureReason: "Card declined",
        message: "ignored",
      }),
    ).toBe("Card declined");

    expect(
      deriveFailureMessage({
        status: "cancelled",
      }),
    ).toBe(DEFAULT_FAILURE_MESSAGE);

    expect(
      deriveFailureMessage({
        status: "pending",
        message: "Awaiting confirmation",
      }),
    ).toBe("Awaiting confirmation");
  });

  it("returns tailored pending copy for different methods", () => {
    expect(getPendingCopy("card")).toMatchObject({
      title: expect.stringContaining("Stripe"),
      actionLabel: expect.stringContaining("Stripe"),
    });

    expect(getPendingCopy("sepa")).toMatchObject({
      title: expect.stringContaining("Waiting"),
    });
  });
});
