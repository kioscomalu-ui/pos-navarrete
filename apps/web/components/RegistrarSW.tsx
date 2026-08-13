'use client';

import { useEffect } from 'react';

export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .catch((e) => console.error('No se pudo registrar el service worker', e));
  }, []);

  return null;
}