export type PaymentUiMethod = "card" | "momo" | "airtel" | "sepa";

export const PAYMENT_PROVIDER_TO_METHOD: Record<string, PaymentUiMethod> = {
  stripe: "card",
  adyen: "card",
  mtn_momo: "momo",
  airtel_money: "airtel",
};

export const DEFAULT_FAILURE_MESSAGE =
  "The payment provider was unable to complete this transaction. Please try again or ask a team member for help.";

export type PaymentStatus = "idle" | "processing" | "pending" | "succeeded" | "error";

export interface PendingCopy {
  title: string;
  body: string;
  actionLabel?: string;
}

export interface FailureContext {
  status?: string | null;
  failureReason?: string | null;
  message?: string | null;
}

export function mapProviderToUiMethod(provider?: string | null): PaymentUiMethod {
  if (!provider) {
    return "card";
  }

  const normalized = provider.toLowerCase();
  return PAYMENT_PROVIDER_TO_METHOD[normalized] ?? "card";
}

export function normalisePaymentStatus(status?: string | null): string {
  return (status ?? "").toLowerCase();
}

export function resolveUiStatus(status: string): PaymentStatus {
  const normalized = normalisePaymentStatus(status);
  if (normalized === "captured") {
    return "succeeded";
  }
  if (normalized === "failed" || normalized === "cancelled") {
    return "error";
  }
  if (normalized === "pending" || normalized === "processing") {
    return "pending";
  }
  return "pending";
}

export function getPendingCopy(method: PaymentUiMethod): PendingCopy {
  switch (method) {
    case "card":
      return {
        title: "Complete payment in Stripe",
        body: "Finish the secure Stripe checkout flow. We’ll refresh your order as soon as Stripe confirms the payment.",
        actionLabel: "Open Stripe checkout",
      };
    case "momo":
      return {
        title: "Approve MTN MoMo request",
        body: "Approve the request on your MTN MoMo device. The order will update automatically once the provider confirms.",
      };
    case "airtel":
      return {
        title: "Confirm Airtel Money payment",
        body: "Authorize the Airtel Money prompt on your phone. We’ll mark the payment as captured when Airtel sends the receipt.",
      };
    case "sepa":
    default:
      return {
        title: "Waiting for payment confirmation",
        body: "We’re waiting for the payment provider to confirm this transaction.",
      };
  }
}

export function deriveFailureMessage(context: FailureContext): string | null {
  const status = normalisePaymentStatus(context.status);

  if (status === "captured") {
    return null;
  }

  if (status === "failed" || status === "cancelled") {
    return context.failureReason ?? DEFAULT_FAILURE_MESSAGE;
  }

  if (context.failureReason) {
    return context.failureReason;
  }

  if (context.message) {
    return context.message;
  }

  return null;
}
