import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';
import { cajasAbiertasDetalle } from './acciones';
import { TablaCajasAbiertas } from '@/components/admin/TablaCajasAbiertas';

export const dynamic = 'force-dynamic';

export default async function CajasAbiertasPage() {
  const sesion = await getSesion();
  if (!['admin', 'gerente'].includes(sesion.rol)) redirect('/caja');

  const cajas = await cajasAbiertasDetalle();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cajas abiertas</h1>
        <p className="text-sm text-verde-claro mt-0.5">
          {cajas.length === 0
            ? 'No hay ninguna caja abierta'
            : `${cajas.length} ${cajas.length === 1 ? 'caja abierta' : 'cajas abiertas'}`}
        </p>
      </div>

      {cajas.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r px-4 py-3">
          <p className="text-sm">
            Cerrar desde acá es una <strong>regularización</strong>: la caja
            queda cerrada con el efectivo que el sistema calculó, sin
            diferencia.
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            Usalo solo cuando la persona ya no puede cerrarla ella misma. Un
            cierre hecho por el propio vendedor, contando la plata, es el que
            sirve para detectar faltantes.
          </p>
        </div>
      )}

      <TablaCajasAbiertas cajas={cajas} />
    </div>
  );
}