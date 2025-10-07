import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  markPaymentCaptured,
  markPaymentFailed,
} from "../../../_shared/payments.ts";

interface NotificationAmount {
  currency?: string;
  value?: number;
}

interface NotificationItemRaw {
  NotificationRequestItem?: NotificationRequestItem;
  [key: string]: unknown;
}

interface NotificationRequestItem {
  eventCode?: string;
  success?: string;
  pspReference?: string;
  originalReference?: string | null;
  merchantReference?: string;
  merchantAccountCode?: string;
  amount?: NotificationAmount;
  reason?: string;
  additionalData?: Record<string, string> | null;
}

interface NotificationPayload {
  live?: string;
  notificationItems?: NotificationItemRaw[];
}

const ADYEN_WEBHOOK_HMAC_KEY = Deno.env.get("ADYEN_WEBHOOK_HMAC_KEY") ?? "";

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyHmac(item: NotificationRequestItem, hmacKey: string): Promise<boolean> {
  const signature = item.additionalData?.hmacSignature ?? item.additionalData?.HMACSignature ?? null;
  if (!signature) {
    return false;
  }

  const signingData = [
    item.pspReference ?? "",
    item.originalReference ?? "",
    item.merchantAccountCode ?? "",
    item.merchantReference ?? "",
    item.amount?.value?.toString() ?? "",
    item.amount?.currency ?? "",
    item.eventCode ?? "",
    (item.success ?? "").toLowerCase() === "true" ? "true" : "false",
  ].join(":");

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(hmacKey),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  const signatureBytes = base64ToBytes(signature);
  const dataBytes = new TextEncoder().encode(signingData);

  return await crypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
}

function normaliseEventCode(eventCode?: string | null): string {
  return (eventCode ?? "").toUpperCase();
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
    }

    const payload = (await req.json()) as NotificationPayload;
    const items = Array.isArray(payload.notificationItems) ? payload.notificationItems : [];

    if (items.length === 0) {
      return jsonResponse({ status: "ignored" });
    }

    const client = createServiceRoleClient();

    for (const rawItem of items) {
      const item = (rawItem.NotificationRequestItem ?? rawItem) as NotificationRequestItem;
      if (!item) {
        continue;
      }

      if (ADYEN_WEBHOOK_HMAC_KEY) {
        const verified = await verifyHmac(item, ADYEN_WEBHOOK_HMAC_KEY);
        if (!verified) {
          console.error("Adyen webhook signature verification failed", { pspReference: item.pspReference });
          return errorResponse(401, "invalid_signature", "Adyen webhook signature did not validate");
        }
      }

      const eventCode = normaliseEventCode(item.eventCode);
      const success = (item.success ?? "").toLowerCase() === "true";
      const paymentId = item.merchantReference ?? null;
      const providerRef = item.pspReference ?? item.originalReference ?? null;

      try {
        if (!paymentId && !providerRef) {
          console.warn("Adyen webhook missing identifiers", item);
          continue;
        }

        if ((eventCode === "AUTHORISATION" || eventCode === "CAPTURE") && success) {
          await markPaymentCaptured(client, {
            paymentId: paymentId ?? undefined,
            providerRef: providerRef ?? undefined,
            newProviderRef: providerRef ?? undefined,
          });
          continue;
        }

        if ((eventCode === "AUTHORISATION" || eventCode === "CAPTURE") && !success) {
          await markPaymentFailed(
            client,
            paymentId ? { paymentId } : providerRef ?? "",
            item.reason ?? "Adyen reported that the payment was not authorised.",
          );
          continue;
        }

        if (eventCode === "REFUND" || eventCode === "CANCELLED" || eventCode === "CANCEL_OR_REFUND") {
          await markPaymentFailed(
            client,
            paymentId ? { paymentId } : providerRef ?? "",
            `Adyen reported ${eventCode.toLowerCase()} for this payment.`,
          );
        }
      } catch (handlerError) {
        console.error("Failed to process Adyen webhook item", handlerError, {
          eventCode,
          paymentId,
          providerRef,
        });
      }
    }

    return new Response("[accepted]", { status: 200 });
  } catch (error) {
    console.error("Adyen webhook error", error);
    return errorResponse(500, "adyen_webhook_error", "Failed to process Adyen webhook");
  }
});
