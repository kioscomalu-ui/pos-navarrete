import { getSesion } from '@/lib/sesion';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();

  return (
    <>
      <Nav
        nombre={`${sesion.nombre} ${sesion.apellido ?? ''}`.trim()}
        rol={sesion.rol}
        sucursal={sesion.sucursalNombre}
      />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}