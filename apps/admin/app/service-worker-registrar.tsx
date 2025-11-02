'use client';

import { useEffect } from 'react';

const SERVICE_WORKER_URL = '/sw.js';
const UPDATE_EVENT = 'service-worker-update';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let isMounted = true;

    const notifyUpdate = (registration: ServiceWorkerRegistration) => {
      if (!isMounted) return;
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { registration } }));
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
          scope: '/',
        });

        if (registration.waiting) {
          notifyUpdate(registration);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate(registration);
            }
          });
        });
      } catch (error) {
        console.error('Service worker registration failed', error);
      }
    };

    register();

    const controllerChangeHandler = () => {
      if (!isMounted) return;
      console.info('Service worker controller changed, latest assets now active.');
    };

    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
    };
  }, []);

  return null;
}
