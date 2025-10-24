"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { PushSubscriptionInput } from "@ecotrips/types";

import { captureClientEvent } from "../../../lib/analytics";

const clientPromise = (async () => {
  if (typeof window === "undefined") return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });
})();

type BannerState = "hidden" | "prompt" | "enabled" | "denied" | "error";

type PushNotificationBannerProps = {
  tags?: string[];
  context?: string;
};

export function PushNotificationBanner({ tags, context }: PushNotificationBannerProps) {
  const [state, setState] = useState<BannerState>("hidden");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }

    const permission = Notification.permission;
    if (permission === "default") {
      setState("prompt");
      captureClientEvent("notification_prompt_shown", { context });
    } else if (permission === "granted") {
      setState("enabled");
    } else {
      setState("denied");
    }
  }, [context]);

  const normalizedTags = useMemo(() => {
    return Array.isArray(tags) && tags.length > 0 ? tags : [context ?? "app"];
  }, [tags, context]);

  if (state === "hidden" || state === "enabled") {
    return null;
  }

  const handleDecline = () => {
    captureClientEvent("notification_prompt_dismissed", { context });
    setState("hidden");
  };

  const handleEnable = async () => {
    captureClientEvent("notification_prompt_clicked", { context });
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setMessage("Push notifications unsupported in this browser.");
      setState("error");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      captureClientEvent("notification_prompt_resolved", { context, permission });
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "prompt");
        setMessage(permission === "denied" ? "Notifications blocked in browser settings." : null);
        return;
      }

      const client = await clientPromise;
      if (!client) {
        setMessage("Supabase client unavailable. Try again after sign-in.");
        setState("error");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? (await subscribeForPush(registration));
      const payload = normalizeSubscription(subscription, normalizedTags);

      await client.notify.pushSubscribe(payload);
      setState("enabled");
      setMessage("Notifications enabled — we will only send urgent travel updates.");
      captureClientEvent("notification_opt_in", { context, tags: normalizedTags });
    } catch (error) {
      console.error("push-subscribe", error);
      setState("error");
      setMessage("Failed to register push notifications.");
      captureClientEvent("notification_opt_in_error", {
        context,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-white">Stay in sync even when offline</p>
        <p>
          Enable push notifications to get SOS confirmations, recap emails, and PlannerCoPilot nudges when inventory responds.
        </p>
        {message && <p className="text-xs text-sky-200">{message}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          {state !== "denied" && state !== "error" && (
            <Button variant="glass" onClick={handleEnable}>
              Enable notifications
            </Button>
          )}
          <Button variant="secondary" onClick={handleDecline}>
            Maybe later
          </Button>
        </div>
        {state === "denied" && (
          <p className="text-xs text-amber-200">
            Notifications are blocked by your browser. Update site settings to turn them back on.
          </p>
        )}
      </div>
    </div>
  );
}

type PushRegistration = ServiceWorkerRegistration;

type PushSub = PushSubscription & { toJSON(): PushSubscriptionJSON };

async function subscribeForPush(registration: PushRegistration): Promise<PushSub> {
  const applicationServerKey = resolveApplicationServerKey();
  return (await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })) as PushSub;
}

function resolveApplicationServerKey(): Uint8Array {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (typeof vapidKey === "string" && vapidKey.length > 0) {
    return base64ToUint8Array(vapidKey);
  }
  return crypto.getRandomValues(new Uint8Array(32));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64String = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64String);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function normalizeSubscription(subscription: PushSub | null, tags: string[]): PushSubscriptionInput {
  if (subscription) {
    const json = subscription.toJSON();
    return {
      endpoint: json.endpoint ?? "",
      keys: {
        p256dh: json.keys?.p256dh ?? crypto.randomUUID(),
        auth: json.keys?.auth ?? crypto.randomUUID(),
      },
      tags,
    };
  }

  return {
    endpoint: `https://updates.ecotrips.app/push/mock-${crypto.randomUUID()}`,
    keys: {
      p256dh: `mock-${crypto.randomUUID()}`,
      auth: crypto.randomUUID(),
    },
    tags,
  };
}
