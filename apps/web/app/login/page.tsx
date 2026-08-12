import { createClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil, error: errPerfil } = await supabase
    .from('usuarios')
    .select('nombre, apellido, rol, sucursal_id')
    .eq('id', user!.id)
    .maybeSingle();

  return (
    <main className="p-8 font-mono text-sm space-y-4">
      <h1 className="text-2xl font-sans font-semibold">Navarrete · Ventas</h1>

      <section>
        <p className="text-neutral-500">auth.uid</p>
        <pre>{user?.id ?? 'sin sesión'}</pre>
      </section>

      <section>
        <p className="text-neutral-500">perfil</p>
        <pre className={errPerfil ? 'text-red-600' : ''}>
          {errPerfil ? errPerfil.message : JSON.stringify(perfil, null, 2)}
        </pre>
      </section>
    </main>
  );
}