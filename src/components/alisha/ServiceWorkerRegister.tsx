'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on the client.
 * Mounted once at the app root (in layout.tsx) — never blocks rendering.
 *
 * Also listens for `controllerchange` so the page reloads automatically
 * when a new service worker activates (ensures users always run the
 * latest app code after a deploy).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Only register in production — dev caching causes headaches.
    if (process.env.NODE_ENV !== 'production') return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[sw] registration failed:', err);
          }
        });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }

    // Reload the page when a new service worker takes control so the
    // user gets the latest app code immediately.
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', onLoad);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
