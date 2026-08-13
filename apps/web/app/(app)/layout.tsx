import { getSesion } from '@/lib/sesion';
import { Nav } from '@/components/Nav';
import { EstadoConexion } from '@/components/EstadoConexion';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSesion();

  return (
    <>
      <Nav
        usuarioId={sesion.usuarioId}
        nombre={sesion.nombre}
        apellido={sesion.apellido}
        rol={sesion.rol}
        sucursalId={sesion.sucursalId}
        sucursalNombre={sesion.sucursalNombre}
      />

      <main className="max-w-6xl mx-auto px-6 py-8 pb-16">{children}</main>

      <EstadoConexion />
    </>
  );
}