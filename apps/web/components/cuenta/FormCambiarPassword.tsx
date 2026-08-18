'use client';

import { useState } from 'react';
import { cambiarMiPassword } from '@/app/(app)/cuenta/acciones';

export function FormCambiarPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [pendiente, setPendiente] = useState(false);

  const coinciden = nueva.length > 0 && nueva === confirmar;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk(false);

    if (!coinciden) {
      setError('Las dos contraseñas nuevas no coinciden');
      return;
    }

    setPendiente(true);
    const r = await cambiarMiPassword(actual, nueva);
    setPendiente(false);

    if (r.error) {
      setError(r.error);
      return;
    }

    setOk(true);
    setActual('');
    setNueva('');
    setConfirmar('');
  }

  return (
    <form onSubmit={enviar} className="max-w-sm space-y-4">
      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">
          Contraseña actual
        </span>
        <input
          type="password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          required
          autoComplete="current-password"
          className="input"
        />
      </label>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">
          Contraseña nueva
        </span>
        <input
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="input"
        />
        <span className="block text-xs text-verde-claro/70 mt-1">
          Al menos 6 caracteres
        </span>
      </label>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">
          Repetir contraseña nueva
        </span>
        <input
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
          autoComplete="new-password"
          className="input"
        />
      </label>

      {error && <p className="text-sm text-rojo-plomo">{error}</p>}
      {ok && (
        <p className="text-sm text-verde-esmalte bg-papel rounded px-3 py-2">
          Contraseña actualizada
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full py-2.5 rounded-lg bg-verde-esmalte text-white
                   font-medium text-sm disabled:opacity-40"
      >
        {pendiente ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}