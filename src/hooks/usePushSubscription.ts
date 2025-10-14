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

interface UsePushSubscriptionResult {
  canSubscribe: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isSubscribing: boolean;
  isUnsubscribing: boolean;
  subscriptionId: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  error: string | null;
  shouldShowIosInstallHint: boolean;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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

  const { data, error } = await supabase.functions.invoke<SubscribeResponse>(
    "notifications/subscribe_push",
    {
      body: payload,
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
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const hasPersistedRef = useRef(false);
  const supportsPush = useMemo(() => isPushSupported() && Boolean(VAPID_PUBLIC_KEY), []);

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
            setSubscriptionId(response?.subscription_id ?? null);
            hasPersistedRef.current = true;
          } catch (persistError) {
            console.error("Failed to refresh push subscription", persistError);
            setSubscriptionId(null);
          }
        }
      } else {
        setIsSubscribed(false);
        setSubscriptionId(null);
      }
      setPermission(Notification.permission);
    })();

    return () => {
      cancelled = true;
    };
  }, [options, supportsPush]);

  const subscribe = useCallback(async () => {
    if (!supportsPush) {
      setPermission("unsupported");
      setError("Push notifications are not supported in this browser.");
      return false;
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
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY as string),
        }));

      const response = await persistSubscription(subscription, options);
      hasPersistedRef.current = true;
      setIsSubscribed(true);
      setSubscriptionId(response?.subscription_id ?? null);
      return true;
    } catch (subscribeError) {
      console.error("Failed to subscribe to push notifications", subscribeError);
      setError("We could not enable notifications. Please try again.");
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [options, supportsPush]);

  const unsubscribe = useCallback(async () => {
    if (!supportsPush) {
      setPermission("unsupported");
      setError("Push notifications are not supported in this browser.");
      return false;
    }

    setIsUnsubscribing(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        setIsSubscribed(false);
        setSubscriptionId(null);
        hasPersistedRef.current = false;
        return true;
      }

      const endpoint = existing.endpoint;
      let backendError: unknown = null;

      try {
        const { error: deleteError } = await supabase.functions.invoke(
          "notifications/unsubscribe_push",
          {
            body: {
              subscription_id: subscriptionId ?? undefined,
              endpoint,
              table_session_id: options.tableSessionId ?? undefined,
              location_id: options.locationId ?? undefined,
              tenant_id: options.tenantId ?? undefined,
            },
          },
        );

        if (deleteError) {
          backendError = deleteError;
        }
      } catch (invokeError) {
        backendError = invokeError;
      }

      let unsubscribed = false;
      try {
        await existing.unsubscribe();
        unsubscribed = true;
      } finally {
        if (unsubscribed) {
          setIsSubscribed(false);
          setSubscriptionId(null);
          hasPersistedRef.current = false;
        }
      }

      if (backendError) {
        console.error("Failed to remove stored push subscription", backendError);
        setError(
          "Notifications were disabled on this device, but we could not update the server.",
        );
      }

      return true;
    } catch (unsubscribeError) {
      console.error("Failed to unsubscribe from push notifications", unsubscribeError);
      setError("We could not disable notifications. Please try again.");
      return false;
    } finally {
      setIsUnsubscribing(false);
    }
  }, [options, subscriptionId, supportsPush]);

  const sendTestNotification = useCallback(async () => {
    if (!supportsPush) {
      setPermission("unsupported");
      setError("Push notifications are not supported in this browser.");
      return;
    }

    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("ICUPA alerts ready", {
        body: "We will notify you here when your table updates.",
        icon: "/placeholder.svg",
        badge: "/placeholder.svg",
        tag: "icupa-test",
        data: { url: "/" },
      });

      if (subscriptionId) {
        try {
          await supabase.functions.invoke("notifications/send_push", {
            body: {
              subscription_id: subscriptionId,
              dry_run: true,
              payload: {
                title: "ICUPA push check",
                body: "Your browser is ready to receive live updates.",
                tag: "icupa-test",
                data: { url: "/" },
              },
            },
          });
        } catch (stubError) {
          console.warn("notifications/send_push dry-run failed", stubError);
        }
      }
    } catch (testError) {
      console.error("Failed to show push notification preview", testError);
      setError("We could not show a test alert. Please try again.");
      throw testError;
    }
  }, [subscriptionId, supportsPush]);

  return {
    canSubscribe: supportsPush,
    permission,
    isSubscribed,
    isSubscribing,
    isUnsubscribing,
    subscriptionId,
    subscribe,
    unsubscribe,
    sendTestNotification,
    error,
    shouldShowIosInstallHint: supportsPush
      ? detectIsIos() && !detectStandalone()
      : false,
  };
}
