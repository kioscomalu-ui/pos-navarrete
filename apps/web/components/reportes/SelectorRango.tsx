'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ETIQUETAS_RANGO, type NombreRango } from '@/lib/rangos-fecha';

export function SelectorRango() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actual = params.get('rango') ?? 'mes';

  function elegir(rango: string) {
    const nuevos = new URLSearchParams(params);
    nuevos.set('rango', rango);
    nuevos.delete('desde');
    nuevos.delete('hasta');
    router.push(`${pathname}?${nuevos}`);
  }

  return (
    <div className="flex gap-1">
      {(Object.keys(ETIQUETAS_RANGO) as NombreRango[]).map((r) => (
        <button
          key={r}
          onClick={() => elegir(r)}
          className={`px-3 py-1.5 text-sm rounded transition ${
            actual === r
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          {ETIQUETAS_RANGO[r]}
        </button>
      ))}
    </div>
  );
}