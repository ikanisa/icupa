import { useEffect, useState } from "react";

interface NetworkStatus {
  isOnline: boolean;
  lastChanged: Date | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    lastChanged: null,
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () =>
      setStatus({ isOnline: true, lastChanged: new Date() });
    const handleOffline = () =>
      setStatus({ isOnline: false, lastChanged: new Date() });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}
