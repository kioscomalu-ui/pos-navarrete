'use client';

import { useActionState, useState } from 'react';
import { crearUsuario, type EstadoAlta } from '@/app/(app)/admin/usuarios/acciones';

const ROLES = [
  { valor: 'vendedor', label: 'Vendedor', desc: 'Caja y consulta de artículos' },
  { valor: 'cobrador', label: 'Cobrador', desc: 'Cartera y cobranzas' },
  { valor: 'gerente', label: 'Gerente', desc: 'Todo lo de su sucursal + reportes' },
  { valor: 'supervisor', label: 'Supervisor', desc: 'Lectura de todas las sucursales' },
  { valor: 'admin', label: 'Administrador', desc: 'Acceso completo' },
];

export function FormNuevoUsuario({
  sucursales,
}: {
  sucursales: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState<EstadoAlta, FormData>(
    crearUsuario,
    {},
  );

  if (!abierto) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setAbierto(true)}
          className="px-3 py-2 text-sm bg-neutral-900 text-white rounded"
        >
          Nuevo usuario
        </button>
      </div>
    );
  }

  return (
    <form
      action={accion}
      className="bg-white border border-neutral-200 rounded p-6 space-y-4"
    >
      <h2 className="font-medium">Nuevo usuario</h2>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Nombre">
          <input name="nombre" required autoFocus className="input" />
        </Campo>
        <Campo label="Apellido">
          <input name="apellido" className="input" />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Email">
          <input name="email" type="email" required className="input" />
        </Campo>
        <Campo label="Contraseña inicial">
          <input
            name="password"
            type="text"
            required
            minLength={8}
            defaultValue={generarPassword()}
            className="input font-mono"
          />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Rol">
          <select name="rol" defaultValue="vendedor" className="input">
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.label} — {r.desc}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Sucursal">
          <select name="sucursalId" required className="input">
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      {estado.ok && (
        <p className="text-sm bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          {estado.ok}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-4 py-2 text-sm border border-neutral-300 rounded"
        >
          Cerrar
        </button>
        <button
          type="submit"
          disabled={pendiente}
          className="px-4 py-2 text-sm bg-neutral-900 text-white rounded disabled:opacity-40"
        >
          {pendiente ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>

      <p className="text-xs text-neutral-500">
        Anotá la contraseña antes de cerrar: no se puede volver a ver.
        El usuario puede cambiarla después.
      </p>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

/** Contraseña legible: dos sílabas + números */
function generarPassword(): string {
  const silabas = ['ma', 'lo', 'ri', 'te', 'sa', 'nu', 'pe', 'ca', 'do', 'vi'];
  const s = () => silabas[Math.floor(Math.random() * silabas.length)];
  return `${s()}${s()}${s()}${Math.floor(1000 + Math.random() * 9000)}`;
}