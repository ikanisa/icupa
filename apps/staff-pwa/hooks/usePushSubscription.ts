import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
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
  subscribe: () => Promise<void>;
  error: string | null;
  shouldShowIosInstallHint: boolean;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

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
  const [error, setError] = useState<string | null>(null);
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
            await persistSubscription(existing, options);
            hasPersistedRef.current = true;
          } catch (persistError) {
            console.error("Failed to refresh push subscription", persistError);
          }
        }
      } else {
        setIsSubscribed(false);
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
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY as string),
        }));

      await persistSubscription(subscription, options);
      hasPersistedRef.current = true;
      setIsSubscribed(true);
    } catch (subscribeError) {
      console.error("Failed to subscribe to push notifications", subscribeError);
      setError("We could not enable notifications. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  }, [options, supportsPush]);

  return {
    canSubscribe: supportsPush,
    permission,
    isSubscribed,
    isSubscribing,
    subscribe,
    error,
    shouldShowIosInstallHint: supportsPush
      ? detectIsIos() && !detectStandalone()
      : false,
  };
}
