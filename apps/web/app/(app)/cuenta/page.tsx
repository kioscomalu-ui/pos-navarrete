import { getSesion } from '@/lib/sesion';
import { FormCambiarPassword } from '@/components/cuenta/FormCambiarPassword';

export default async function CuentaPage() {
  const sesion = await getSesion();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-verde-claro mt-1">
          {sesion.nombre} {sesion.apellido ?? ''} · {sesion.rol}
        </p>
      </div>

      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6">
        <h2 className="text-sm font-medium mb-4">Cambiar contraseña</h2>
        <FormCambiarPassword />
      </section>
    </div>
  );
}