'use client';

import { useEffect, useRef, useState } from 'react';
import { CONDICION_IVA_RECEPTOR, TIPO_DOC } from '@/lib/facturacion/tipos';
import type { DatosReceptor } from '@/app/(app)/caja/facturacion-acciones';

interface Props {
  total: number;
  onConfirmar: (r: DatosReceptor) => void;
  onCancelar: () => void;
}

/**
 * Por encima de cierto monto, ARCA exige identificar al comprador.
 * El umbral lo actualiza la normativa: confirmalo con el contador.
 */
const UMBRAL_IDENTIFICACION = 500_000;

export function DatosFactura({ total, onConfirmar, onCancelar }: Props) {
  const [tipo, setTipo] = useState<'final' | 'identificado'>('final');
  const [docTipo, setDocTipo] = useState<number>(TIPO_DOC.DNI);
  const [docNro, setDocNro] = useState('');
  const [nombre, setNombre] = useState('');
  const [condIva, setCondIva] = useState<number>(CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL);
  const input = useRef<HTMLInputElement>(null);

  const requiereIdentificar = total >= UMBRAL_IDENTIFICACION;

  useEffect(() => {
    if (requiereIdentificar) setTipo('identificado');
  }, [requiereIdentificar]);

  useEffect(() => {
    if (tipo === 'identificado') input.current?.focus();
  }, [tipo]);

  function confirmar() {
    if (tipo === 'final') {
      onConfirmar({
        docTipo: TIPO_DOC.CONSUMIDOR_FINAL,
        docNro: '0',
        condicionIva: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL,
      });
      return;
    }

    const limpio = docNro.replace(/\D/g, '');
    if (limpio.length < 7) return;

    onConfirmar({
      nombre: nombre.trim() || undefined,
      docTipo,
      docNro: limpio,
      condicionIva: condIva,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-mostrador rounded-lg shadow-xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-medium">Datos para la factura</h2>
          <p className="num text-sm text-verde-claro">
            Total ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {!requiereIdentificar && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('final')}
              className={`py-2.5 rounded text-sm ${
                tipo === 'final'
                  ? 'bg-verde-esmalte text-white'
                  : 'ring-1 ring-tiza/60'
              }`}
            >
              Consumidor final
            </button>
            <button
              type="button"
              onClick={() => setTipo('identificado')}
              className={`py-2.5 rounded text-sm ${
                tipo === 'identificado'
                  ? 'bg-verde-esmalte text-white'
                  : 'ring-1 ring-tiza/60'
              }`}
            >
              Con datos
            </button>
          </div>
        )}

        {requiereIdentificar && (
          <p className="text-xs bg-ambar-suave border-l-4 border-ambar-dial
                        rounded-r px-3 py-2">
            Por el monto de la operación hay que identificar al comprador.
          </p>
        )}

        {tipo === 'identificado' && (
          <div className="space-y-3">
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <select
                value={docTipo}
                onChange={(e) => setDocTipo(Number(e.target.value))}
                className="input"
              >
                <option value={TIPO_DOC.DNI}>DNI</option>
                <option value={TIPO_DOC.CUIT}>CUIT</option>
                <option value={TIPO_DOC.CUIL}>CUIL</option>
              </select>

              <input
                ref={input}
                value={docNro}
                onChange={(e) => setDocNro(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmar()}
                inputMode="numeric"
                placeholder="Número"
                className="input num"
              />
            </div>

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre o razón social"
              className="input"
            />

            <select
              value={condIva}
              onChange={(e) => setCondIva(Number(e.target.value))}
              className="input"
            >
              <option value={CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL}>
                Consumidor final
              </option>
              <option value={CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO}>
                Responsable inscripto
              </option>
              <option value={CONDICION_IVA_RECEPTOR.MONOTRIBUTO}>
                Monotributo
              </option>
              <option value={CONDICION_IVA_RECEPTOR.EXENTO}>Exento</option>
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded ring-1 ring-tiza/60 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={tipo === 'identificado' && docNro.replace(/\D/g, '').length < 7}
            className="flex-1 py-2.5 rounded bg-verde-esmalte text-white
                       font-medium text-sm disabled:opacity-30"
          >
            Facturar
          </button>
        </div>
      </div>
    </div>
  );
}