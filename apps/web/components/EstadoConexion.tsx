'use client';

import { useEffect, useState } from 'react';
import { pendientes, procesar } from '@/lib/cola-sync';

export function EstadoConexion() {
  const [online, setOnline] = useState(true);
  const [enCola, setEnCola] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    const t = setInterval(async () => setEnCola(await pendientes()), 3000);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
    };
  }, []);

  if (online && enCola === 0) return null;

  return (
    <button
      onClick={() => void procesar()}
      className={`fixed bottom-0 inset-x-0 z-40 py-2 text-center text-sm ${
        online ? 'bg-neutral-900 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      {!online
        ? `Sin conexión${enCola > 0 ? ` · ${enCola} sin enviar` : ''}`
        : `Sincronizando ${enCola} operaciones…`}
    </button>
  );
}