import { useEffect, useMemo, useState } from "react";

interface VoiceCapabilities {
  supported: boolean;
  microphonePermission: PermissionState | null;
  requestPermission: () => Promise<PermissionState>;
}

export function useVoiceCapabilities(): VoiceCapabilities {
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const hasSupport = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setSupported(hasSupport);

    if (!hasSupport || typeof navigator.permissions === "undefined") {
      return;
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setPermissionState(status.state);
        status.addEventListener('change', () => setPermissionState(status.state));
      })
      .catch(() => setPermissionState(null));
  }, []);

  const requestPermission = useMemo(() => {
    return async () => {
      if (!supported) {
        return 'denied';
      }

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return 'granted' as PermissionState;
      } catch (error) {
        console.warn('Microphone permission denied', error);
        return 'denied' as PermissionState;
      }
    };
  }, [supported]);

  return {
    supported,
    microphonePermission: permissionState,
    requestPermission,
  };
}
