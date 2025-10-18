"use client";

import { useEffect } from "react";

export function ServiceWorkerBridge() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.info("Service worker registered", {
          scope: registration.scope,
        });
      } catch (error) {
        console.error("Failed to register service worker", error);
      }
    };

    register();
  }, []);

  return null;
}
