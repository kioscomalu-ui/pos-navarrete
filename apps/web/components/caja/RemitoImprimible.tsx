'use client';

import { EMPRESA, REMITO, formatearImporte, formatearFecha } from '@pos/shared/constants/empresa';
import type { VentaLocal } from '@/lib/db-local';

interface Props {
  venta: VentaLocal;
  sucursal: string;
  vendedor: string;
}

/**
 * Se renderiza oculto y solo aparece al imprimir.
 * Los estilos de impresión están en globals.css.
 */
export function RemitoImprimible({ venta, sucursal, vendedor }: Props) {
  return (
    <div className="remito-print">
      <div className="remito-empresa">
        {EMPRESA.razonSocial.toUpperCase()}
      </div>

      <div className="remito-datos">
        {EMPRESA.domicilio && <div>{EMPRESA.domicilio}</div>}
        <div>{EMPRESA.localidad}</div>
        {EMPRESA.cuit && <div>CUIT {EMPRESA.cuit}</div>}
        {EMPRESA.condicionIVA && <div>{EMPRESA.condicionIVA}</div>}
      </div>

      <hr />

      <div className="remito-tipo">{REMITO.titulo}</div>
      <div className="remito-subtipo">{REMITO.subtitulo}</div>

      <hr />

      <div className="remito-meta">
        <div><span>Nº</span><span>{venta.remitoNumero ?? '—'}</span></div>
        <div><span>Fecha</span><span>{formatearFecha(new Date(venta.fecha))}</span></div>
        <div><span>Sucursal</span><span>{sucursal}</span></div>
        <div><span>Atendió</span><span>{vendedor}</span></div>
      </div>

      <hr />

      <div className="remito-items">
        {venta.items.map((item, i) => (
          <div key={i} className="remito-item">
            <div className="remito-linea">
              <span className="remito-nombre">{item.nombre}</span>
              <span className="remito-importe">{formatearImporte(item.subtotal)}</span>
            </div>
            <div className="remito-detalle">
              {item.unidad === 'unidad'
                ? `${item.cantidad} un`
                : `${item.cantidad.toFixed(3)} ${item.unidad}`}
              {' × '}{formatearImporte(item.precioUnitario)}
            </div>
          </div>
        ))}
      </div>

      <hr />

      <div className="remito-total">
        <span>TOTAL</span>
        <span>$ {formatearImporte(venta.total)}</span>
      </div>

      <hr />

      <div className="remito-meta">
        <div><span>Pago</span><span>{etiquetaPago(venta.metodoPago)}</span></div>
        {venta.recibido != null && (
          <div><span>Recibido</span><span>{formatearImporte(venta.recibido)}</span></div>
        )}
        {venta.vuelto != null && venta.vuelto > 0 && (
          <div><span>Vuelto</span><span>{formatearImporte(venta.vuelto)}</span></div>
        )}
      </div>

      <div className="remito-legal">{REMITO.leyendaLegal}</div>
      <div className="remito-pie">{REMITO.politicaCambios}</div>
      <div className="remito-gracias">{REMITO.despedida}</div>
    </div>
  );
}

function etiquetaPago(m: string) {
  const mapa: Record<string, string> = {
    efectivo: 'Efectivo',
    posnet: 'Tarjeta / POSNET',
    billetera: 'Billetera virtual',
    mixto: 'Pago mixto',
    cuenta_corriente: 'Cuenta corriente',
  };
  return mapa[m] ?? m;
}