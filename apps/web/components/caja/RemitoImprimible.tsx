'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EMPRESA,
  REMITO,
  formatearImporte,
  formatearFecha,
} from '@pos/shared/constants/empresa';
import type { VentaLocal } from '@/lib/db-local';

interface Props {
  venta: VentaLocal;
  sucursal: string;
  vendedor: string;
}

/**
 * Se renderiza oculto y solo aparece al imprimir.
 * Los estilos viven en globals.css, dentro del @media print.
 */
export function RemitoImprimible({ venta, sucursal, vendedor }: Props) {
  const esMixto = venta.metodoPago === 'mixto';

    // El remito se monta como hijo directo del <body>, fuera del árbol
  // de la app. La regla `body > * { display: none }` del @media print
  // oculta el contenedor de Next.js — y con él, cualquier cosa que
  // esté adentro, por más que le pongamos display: block.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  return createPortal(
    <div className="remito-print">
      {/* ---- Encabezado ---- */}
      <div className="remito-empresa">
        {(EMPRESA.nombreFantasia || EMPRESA.razonSocial).toUpperCase()}
      </div>

      {EMPRESA.nombreFantasia && (
        <div className="remito-razon-social">{EMPRESA.razonSocial}</div>
      )}

      <div className="remito-datos">
        {EMPRESA.domicilio && <div>{EMPRESA.domicilio}</div>}
        <div>{EMPRESA.localidad}</div>
        {EMPRESA.cuit && <div>CUIT {formatearCuit(EMPRESA.cuit)}</div>}
        {EMPRESA.condicionIVA && <div>{EMPRESA.condicionIVA}</div>}
      </div>

      <hr />

      {/* ---- Tipo de documento ---- */}
      <div className="remito-tipo">{REMITO.titulo}</div>
      <div className="remito-subtipo">{REMITO.subtitulo}</div>

      <hr />

      {/* ---- Datos del comprobante ---- */}
      <div className="remito-meta">
        <div>
          <span>Nº</span>
          <span>{venta.remitoNumero ?? '—'}</span>
        </div>
        <div>
          <span>Fecha</span>
          <span>{formatearFecha(new Date(venta.fecha))}</span>
        </div>
        <div>
          <span>Sucursal</span>
          <span>{sucursal}</span>
        </div>
        <div>
          <span>Atendió</span>
          <span>{vendedor}</span>
        </div>
        {venta.clienteNombre && (
          <div>
            <span>Cliente</span>
            <span>{venta.clienteNombre}</span>
          </div>
        )}
      </div>

      <hr />

      {/* ---- Items ---- */}
      <div className="remito-items">
        {venta.items.map((item, i) => (
          <div key={i} className="remito-item">
            <div className="remito-linea">
              <span className="remito-nombre">{item.nombre}</span>
              <span className="remito-importe">
                {formatearImporte(item.subtotal)}
              </span>
            </div>
            <div className="remito-detalle">
              {item.unidad === 'unidad'
                ? `${item.cantidad} un`
                : `${item.cantidad.toFixed(3)} ${item.unidad}`}
              {' × '}
              {formatearImporte(item.precioUnitario)}
            </div>
          </div>
        ))}
      </div>

      <hr />

      {/* ---- Totales ---- */}
      {venta.descuentoTotal > 0 && (
        <div className="remito-meta">
          <div>
            <span>Subtotal</span>
            <span>{formatearImporte(venta.subtotal)}</span>
          </div>
          <div>
            <span>Descuento</span>
            <span>-{formatearImporte(venta.descuentoTotal)}</span>
          </div>
        </div>
      )}

      <div className="remito-total">
        <span>TOTAL</span>
        <span>$ {formatearImporte(venta.total)}</span>
      </div>

      <hr />

      {/* ---- Forma de pago ---- */}
      <div className="remito-meta">
        <div>
          <span>Pago</span>
          <span>{esMixto ? 'Combinado' : etiquetaPago(venta.metodoPago)}</span>
        </div>

        {/* Venta mixta: una línea por cada método usado */}
        {esMixto &&
          venta.pagos?.map((p) => (
            <div key={p.metodo}>
              <span className="remito-submetodo">{etiquetaPago(p.metodo)}</span>
              <span>{formatearImporte(p.monto)}</span>
            </div>
          ))}

        {venta.recibido != null && (
          <div>
            <span>Recibido</span>
            <span>{formatearImporte(venta.recibido)}</span>
          </div>
        )}
        {venta.vuelto != null && venta.vuelto > 0 && (
          <div>
            <span>Vuelto</span>
            <span>{formatearImporte(venta.vuelto)}</span>
          </div>
        )}
      </div>

      {/* ---- Pie ---- */}
      <div className="remito-legal">{REMITO.leyendaLegal}</div>
      <div className="remito-pie">{REMITO.politicaCambios}</div>
      <div className="remito-gracias">{REMITO.despedida}</div>
        </div>,
    document.body,
  );
}

// ====================================================================

function etiquetaPago(m: string): string {
  const mapa: Record<string, string> = {
    efectivo: 'Efectivo',
    posnet: 'Tarjeta',
    billetera: 'Billetera virtual',
    mixto: 'Pago combinado',
    cuenta_corriente: 'Cuenta corriente',
  };
  return mapa[m] ?? m;
}

/** 27228168829 → 27-22816882-9 */
export function formatearCuit(cuit: string): string {
  const n = cuit.replace(/\D/g, '');
  if (n.length !== 11) return cuit;
  return `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}`;
}