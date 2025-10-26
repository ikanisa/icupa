import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  base64UrlToUint8Array,
  detectIsIos,
  detectStandalone,
  isPushSupported,
} from "@/lib/push";

interface UsePushSubscriptionOptions {
  tableSessionId?: string | null;
  locationId?: string | null;
  tenantId?: string | null;
}

interface SubscribeResponse {
  subscription_id?: string | null;
  status?: string;
}

type VerificationStatus = "idle" | "sending" | "delivered" | "error";

export interface UsePushSubscriptionResult {
  canSubscribe: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isSubscribing: boolean;
  subscribe: () => Promise<void>;
  error: string | null;
  verify: () => Promise<void>;
  isVerifying: boolean;
  verificationStatus: VerificationStatus;
  unsubscribe: () => Promise<void>;
  isUnsubscribing: boolean;
  subscriptionId: string | null;
  shouldShowIosInstallHint: boolean;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const SUBSCRIPTION_STORAGE_KEY = "icupa_push_subscription_id";

async function persistSubscription(
  subscription: PushSubscription,
  options: UsePushSubscriptionOptions,
): Promise<SubscribeResponse> {
  const payload = {
    subscription: subscription.toJSON(),
    table_session_id: options.tableSessionId ?? undefined,
    location_id: options.locationId ?? undefined,
    tenant_id: options.tenantId ?? undefined,
    locale: typeof navigator !== "undefined" ? navigator.language : undefined,
  };

  const headers = options.tableSessionId
    ? { "x-icupa-session": options.tableSessionId }
    : undefined;

  const { data, error } = await supabase.functions.invoke<SubscribeResponse>(
    "notifications/subscribe_push",
    {
      body: payload,
      headers,
    },
  );

  if (error) {
    throw error;
  }

  return data ?? {};
}

export function usePushSubscription(
  options: UsePushSubscriptionOptions,
): UsePushSubscriptionResult {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window === "undefined" ? "unsupported" : Notification.permission,
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [subscriptionId, setSubscriptionId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return window.localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    } catch (_error) {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const hasPersistedRef = useRef(false);
  const supportsPush = useMemo(() => isPushSupported() && Boolean(VAPID_PUBLIC_KEY), []);

  const updateStoredSubscriptionId = useCallback((next: string | null) => {
    setSubscriptionId(next);
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (next) {
        window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, next);
      } else {
        window.localStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
      }
    } catch (_storageError) {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (!supportsPush) {
      setPermission("unsupported");
      return;
    }

    let cancelled = false;
    void (async () => {
      const registration = await navigator.serviceWorker.ready;
      if (cancelled) {
        return;
      }
      const existing = await registration.pushManager.getSubscription();
      if (cancelled) {
        return;
      }
      if (existing) {
        setIsSubscribed(true);
        if (!hasPersistedRef.current) {
          try {
            const response = await persistSubscription(existing, options);
            updateStoredSubscriptionId(response.subscription_id ?? null);
            hasPersistedRef.current = true;
          } catch (persistError) {
            console.error("Failed to refresh push subscription", persistError);
          }
        }
      } else {
        setIsSubscribed(false);
        updateStoredSubscriptionId(null);
      }
      setPermission(Notification.permission);
    })();

    return () => {
      cancelled = true;
    };
  }, [options, supportsPush, updateStoredSubscriptionId]);

  const subscribe = useCallback(async () => {
    if (!supportsPush) {
      setPermission("unsupported");
      setError("Push notifications are not supported in this browser.");
      return;
    }

    setError(null);
    setIsSubscribing(true);
    try {
      const currentPermission = Notification.permission;
      if (currentPermission === "denied") {
        setPermission("denied");
        setError(
          "Notifications are blocked. Update your browser settings to re-enable alerts.",
        );
        return;
      }

      const requested = currentPermission === "default" ? await Notification.requestPermission() : currentPermission;
      setPermission(requested);

      if (requested !== "granted") {
        if (requested === "denied") {
          setError(
            "Notifications are blocked. Update your browser settings to re-enable alerts.",
          );
        }
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY as string).buffer as ArrayBuffer,
        }));

      const response = await persistSubscription(subscription, options);
      updateStoredSubscriptionId(response.subscription_id ?? null);
      hasPersistedRef.current = true;
      setIsSubscribed(true);
      setVerificationStatus("idle");
    } catch (subscribeError) {
      console.error("Failed to subscribe to push notifications", subscribeError);
      setError("We could not enable notifications. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  }, [options, supportsPush, updateStoredSubscriptionId]);

  const unsubscribe = useCallback(async () => {
    if (!supportsPush) {
      setPermission("unsupported");
      setError("Push notifications are not supported in this browser.");
      return;
    }

    setError(null);
    setIsUnsubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        setIsSubscribed(false);
        updateStoredSubscriptionId(null);
        return;
      }

      try {
        const { error: serverError } = await supabase.functions.invoke(
          "notifications/unsubscribe_push",
          {
            body: {
              subscription_id: subscriptionId ?? undefined,
              endpoint: existing.endpoint,
            },
            headers: options.tableSessionId
              ? { "x-icupa-session": options.tableSessionId }
              : undefined,
          },
        );
        if (serverError) {
          console.error("Failed to unregister push subscription server-side", serverError);
        }
      } catch (invokeError) {
        console.error("Unexpected error invoking unsubscribe function", invokeError);
      }

      await existing.unsubscribe();
      setIsSubscribed(false);
      updateStoredSubscriptionId(null);
      setVerificationStatus("idle");
    } catch (unsubscribeError) {
      console.error("Failed to unsubscribe from push notifications", unsubscribeError);
      setError("We could not disable notifications. Please try again.");
    } finally {
      setIsUnsubscribing(false);
    }
  }, [subscriptionId, supportsPush, updateStoredSubscriptionId, options.tableSessionId]);

  const verify = useCallback(async () => {
    if (!supportsPush) {
      setPermission("unsupported");
      setError("Push notifications are not supported in this browser.");
      return;
    }

    if (!subscriptionId) {
      setError("Enable alerts before sending a test notification.");
      setVerificationStatus("error");
      return;
    }

    setError(null);
    setIsVerifying(true);
    setVerificationStatus("sending");
    try {
      const payload = {
        title: "ICUPA alerts ready",
        body: "This is a test notification to confirm push alerts are working.",
        data: {
          type: "icupa-test-notification",
          url: typeof window !== "undefined" ? window.location.href : undefined,
        },
      } satisfies Record<string, unknown>;

      const { error: serverError } = await supabase.functions.invoke(
        "notifications/send_push",
        {
          body: {
            subscription_id: subscriptionId,
            payload,
          },
        },
      );

      if (serverError) {
        throw new Error(serverError.message ?? "Failed to queue test notification");
      }

      setVerificationStatus("delivered");
    } catch (verifyError) {
      console.error("Failed to send push verification", verifyError);
      setVerificationStatus("error");
      setError("We could not send a test notification. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  }, [subscriptionId, supportsPush]);

  return {
    canSubscribe: supportsPush,
    permission,
    isSubscribed,
    isSubscribing,
    subscribe,
    verify,
    isVerifying,
    verificationStatus,
    unsubscribe,
    isUnsubscribing,
    subscriptionId,
    error,
    shouldShowIosInstallHint: supportsPush
      ? detectIsIos() && !detectStandalone()
      : false,
  };
}
