'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setCargando(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email o contraseña incorrectos');
      setCargando(false);
      return;
    }

    router.push('/caja');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="w-full max-w-sm bg-white p-8 rounded-lg shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight mb-1">
          Navarrete Elsa Graciela
        </h1>
        <p className="text-sm text-neutral-500 mb-6">Sistema de ventas</p>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
            autoComplete="username"
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />

          {/* Poder leer lo escrito evita el ida y vuelta de "no me toma
              la clave", sobre todo desde el celular */}
          <div className="relative">
            <input
              type={verPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              autoComplete="current-password"
              className="w-full px-3 py-2 pr-20 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1
                         text-xs text-neutral-500 hover:text-neutral-900"
            >
              {verPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={entrar}
            disabled={cargando || !email || !password}
            className="w-full py-2 bg-neutral-900 text-white rounded font-medium disabled:opacity-40"
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </div>
    </main>
  );
}