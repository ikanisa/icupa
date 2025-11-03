const UPDATE_EVENT = "icupa:pwa-update";
const OFFLINE_EVENT = "icupa:pwa-offline";

export type PwaUpdateEventDetail = {
  refresh: () => void;
};

export const registerServiceWorker = () => {
  if (typeof window === "undefined") {
    return;
  }

  void import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        document.dispatchEvent(
          new CustomEvent<PwaUpdateEventDetail>(UPDATE_EVENT, {
            detail: {
              refresh: () => updateSW(true),
            },
          }),
        );
      },
      onOfflineReady() {
        document.dispatchEvent(new Event(OFFLINE_EVENT));
      },
    });
  });
};

export const addPwaUpdateListener = (handler: (detail: PwaUpdateEventDetail) => void) => {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<PwaUpdateEventDetail>;
    handler(customEvent.detail);
  };
  document.addEventListener(UPDATE_EVENT, listener);
  return () => document.removeEventListener(UPDATE_EVENT, listener);
};

export const addOfflineReadyListener = (handler: () => void) => {
  document.addEventListener(OFFLINE_EVENT, handler);
  return () => document.removeEventListener(OFFLINE_EVENT, handler);
};
