'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on the client.
 * Mounted once at the app root (in layout.tsx) — never blocks rendering.
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
          // Don't spam the console in production.
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[sw] registration failed:', err);
          }
        });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
