'use client';

import { useState } from 'react';
import { cambiarMiPassword } from '@/app/(app)/cuenta/acciones';
import { CampoPassword } from '@/components/CampoPassword';

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
      <CampoPassword
        name="actual"
        label="Contraseña actual"
        value={actual}
        onChange={setActual}
        required
        autoComplete="current-password"
      />

      <CampoPassword
        name="nueva"
        label="Contraseña nueva"
        value={nueva}
        onChange={setNueva}
        required
        autoComplete="new-password"
        ayuda="Al menos 6 caracteres"
      />

      <CampoPassword
        name="confirmar"
        label="Repetir contraseña nueva"
        value={confirmar}
        onChange={setConfirmar}
        required
        autoComplete="new-password"
        error={
          confirmar.length > 0 && !coinciden
            ? 'No coincide con la anterior'
            : undefined
        }
      />

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