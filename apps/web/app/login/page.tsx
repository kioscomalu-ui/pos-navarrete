'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
            className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />

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