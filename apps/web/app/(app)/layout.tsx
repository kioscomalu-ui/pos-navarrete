import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';
import { createClient } from '@/lib/supabase-server';
import { Nav } from '@/components/Nav';
import { EstadoConexion } from '@/components/EstadoConexion';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');

  const supabase = await createClient();

  const { data: sucursalesAutorizadas } = await supabase.rpc(
    'sucursales_autorizadas',
    { p_usuario_id: sesion.usuarioId },
  );

  return (
    <div className="min-h-screen bg-papel">
      <Nav
        usuarioId={sesion.usuarioId}
        nombre={sesion.nombre}
        apellido={sesion.apellido}
        rol={sesion.rol}
        sucursalId={sesion.sucursalId}
        sucursalNombre={sesion.sucursalNombre}
        sucursalesAutorizadas={(sucursalesAutorizadas ?? []).map((s: any) => ({
          id: s.id,
          nombre: s.nombre,
          esPrincipal: s.es_principal,
        }))}
      />

      <EstadoConexion />

      <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}