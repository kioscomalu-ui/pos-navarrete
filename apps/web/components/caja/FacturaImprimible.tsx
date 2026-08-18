'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  EMPRESA,
  formatearImporte,
  formatearFecha,
} from '@pos/shared/constants/empresa';
import { formatearCuit } from './RemitoImprimible';
import type { VentaLocal } from '@/lib/db-local';

export interface DatosFacturaImpresa {
  tipo: 'factura_a' | 'factura_b' | 'factura_c';
  puntoVenta: number;
  numero: number;
  cae: string;
  caeVencimiento: string;

  qrDatos: string;

  receptor: {
    nombre?: string | null;
    docTipo: number;
    docNro: string;
    condicionIva: number;
  };

  iva?: Array<{ alicuota: number; base: number; importe: number }>;
}

interface Props {
  venta: VentaLocal;
  factura: DatosFacturaImpresa;
  sucursal: string;
  vendedor: string;
}

const LETRA: Record<DatosFacturaImpresa['tipo'], string> = {
  factura_a: 'A',
  factura_b: 'B',
  factura_c: 'C',
};

const ETIQUETA_DOC: Record<number, string> = {
  80: 'CUIT',
  86: 'CUIL',
  96: 'DNI',
  99: '',
};

const ETIQUETA_COND_IVA: Record<number, string> = {
  1: 'Responsable Inscripto',
  4: 'Exento',
  5: 'Consumidor Final',
  6: 'Monotributo',
  7: 'No Categorizado',
};

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  posnet: 'Tarjeta',
  billetera: 'Billetera virtual',
  cuenta_corriente: 'Cuenta corriente',
};

export function FacturaImprimible({
  venta,
  factura,
  sucursal,
  vendedor,
}: Props) {
  const [qrImagen, setQrImagen] = useState('');

  useEffect(() => {
    if (!factura.qrDatos) return;

    void QRCode.toDataURL(factura.qrDatos, {
      margin: 0,
      width: 220,
      errorCorrectionLevel: 'M',
    })
      .then(setQrImagen)
      .catch(() => setQrImagen(''));
  }, [factura.qrDatos]);

  const identificado = factura.receptor.docTipo !== 99;
  const esMixto = venta.metodoPago === 'mixto';

  const discriminaIva = factura.tipo === 'factura_a' && !!factura.iva?.length;

  const numeroFormateado =
    `${String(factura.puntoVenta).padStart(5, '0')}-` +
    `${String(factura.numero).padStart(8, '0')}`;

  const neto = factura.iva?.reduce((a, i) => a + i.base, 0) ?? 0;
  const totalIva = factura.iva?.reduce((a, i) => a + i.importe, 0) ?? 0;

  return (
    <div className="remito-print">
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
        {EMPRESA.ingresosBrutos && <div>IIBB {EMPRESA.ingresosBrutos}</div>}
        {EMPRESA.inicioActividades && (
          <div>Inicio act. {EMPRESA.inicioActividades}</div>
        )}
      </div>

      <hr />

      <div className="factura-tipo">
        <span className="factura-letra">{LETRA[factura.tipo]}</span>
        <span>FACTURA</span>
      </div>

      <hr />

      <div className="remito-meta">
        <div>
          <span>Nº</span>
          <span>{numeroFormateado}</span>
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
      </div>

      <hr />

      <div className="remito-meta">
        {identificado ? (
          <>
            {factura.receptor.nombre && (
              <div>
                <span>Cliente</span>
                <span>{factura.receptor.nombre}</span>
              </div>
            )}
            <div>
              <span>{ETIQUETA_DOC[factura.receptor.docTipo] ?? 'Doc.'}</span>
              <span>
                {factura.receptor.docTipo === 80
                  ? formatearCuit(factura.receptor.docNro)
                  : factura.receptor.docNro}
              </span>
            </div>
            <div>
              <span>Cond. IVA</span>
              <span>
                {ETIQUETA_COND_IVA[factura.receptor.condicionIva] ?? '—'}
              </span>
            </div>
          </>
        ) : (
          <div>
            <span>Cliente</span>
            <span>Consumidor Final</span>
          </div>
        )}
      </div>

      <hr />

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

      {venta.descuentoTotal > 0 && (
        <div className="remito-meta">
          <div>
            <span>Descuento</span>
            <span>-{formatearImporte(venta.descuentoTotal)}</span>
          </div>
        </div>
      )}

      {discriminaIva && (
        <>
          <div className="remito-meta">
            <div>
              <span>Neto gravado</span>
              <span>{formatearImporte(neto)}</span>
            </div>

            {factura.iva!.map((linea) => (
              <div key={linea.alicuota}>
                <span>IVA {linea.alicuota}%</span>
                <span>{formatearImporte(linea.importe)}</span>
              </div>
            ))}

            {factura.iva!.length > 1 && (
              <div>
                <span>Total IVA</span>
                <span>{formatearImporte(totalIva)}</span>
              </div>
            )}
          </div>
          <hr />
        </>
      )}

      <div className="remito-total">
        <span>TOTAL</span>
        <span>$ {formatearImporte(venta.total)}</span>
      </div>

      <hr />

      <div className="remito-meta">
        <div>
          <span>Pago</span>
          <span>
            {esMixto
              ? 'Combinado'
              : (ETIQUETA_METODO[venta.metodoPago] ?? venta.metodoPago)}
          </span>
        </div>

        {esMixto &&
          venta.pagos?.map((p) => (
            <div key={p.metodo}>
              <span className="remito-submetodo">
                {ETIQUETA_METODO[p.metodo] ?? p.metodo}
              </span>
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

      <hr />

      <div className="factura-cae">
        <div>CAE {factura.cae}</div>
        <div>Vto. CAE {formatearFechaCorta(factura.caeVencimiento)}</div>
      </div>

      {qrImagen && (
        <div className="factura-qr">
          <img src={qrImagen} alt="" width={110} height={110} />
        </div>
      )}

      <div className="factura-pie">Comprobante autorizado por ARCA</div>

      <div className="remito-gracias">¡GRACIAS POR SU COMPRA!</div>
    </div>
  );
}

// ====================================================================

/** "2026-09-12" → "12/09/2026" */
function formatearFechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}