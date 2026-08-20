import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';
import { createClient } from '@/lib/supabase-server';
import { Nav } from '@/components/Nav';
import { EstadoConexion } from '@/components/EstadoConexion';

/**
 * Sin caché: este layout resuelve QUIÉN es el usuario actual, y ese
 * dato baja a toda la aplicación (nav, chat, caja). Si Next reutiliza
 * una versión cacheada, un dispositivo compartido puede quedar
 * mostrando —y mandando mensajes con— la identidad del usuario
 * anterior, aunque el token de sesión ya sea el nuevo.
 */
export const dynamic = 'force-dynamic';

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