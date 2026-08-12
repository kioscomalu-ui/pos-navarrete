import { createClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('sucursales').select('codigo, nombre');

  return (
    <main className="p-8 font-mono">
      <h1 className="text-2xl mb-4">Navarrete · Ventas</h1>
      {error ? (
        <pre className="text-red-600">{error.message}</pre>
      ) : (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </main>
  );
}