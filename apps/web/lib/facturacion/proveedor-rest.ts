import 'server-only';
import type {
  DatosComprobante,
  ProveedorFacturacion,
  ResultadoCAE,
} from './tipos';
import { COD_COMPROBANTE } from './tipos';

/**
 * Adaptador genérico para proveedores REST de facturación.
 * Los nombres de campo varían entre proveedores: ajustá el mapeo
 * según la documentación del que contrates.
 */
export class ProveedorREST implements ProveedorFacturacion {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private cuit: string,
  ) {}

  async solicitarCAE(d: DatosComprobante): Promise<ResultadoCAE> {
    try {
      const respuesta = await fetch(`${this.baseUrl}/comprobantes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          cuit_emisor: this.cuit,
          punto_venta: d.puntoVenta,
          tipo_comprobante: COD_COMPROBANTE[d.tipo],
          fecha: d.fecha.toISOString().slice(0, 10),

          documento_tipo: d.receptor.docTipo,
          documento_numero: d.receptor.docNro,
          condicion_iva_receptor: d.receptor.condicionIva,
          razon_social: d.receptor.nombre,

          importe_neto: d.neto,
          importe_iva: d.iva,
          importe_total: d.total,

          items: d.items.map((i) => ({
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precio_unitario: i.precioUnitario,
            importe: i.subtotal,
          })),
        }),
        // Si tarda más de 15 segundos, no vale la pena hacer esperar
        signal: AbortSignal.timeout(15_000),
      });

      if (!respuesta.ok) {
        const texto = await respuesta.text();
        return {
          ok: false,
          error: `${respuesta.status}: ${texto.slice(0, 200)}`,
          // 5xx y 429 son transitorios; 4xx suele ser un dato mal armado
          reintentable: respuesta.status >= 500 || respuesta.status === 429,
        };
      }

      const data = await respuesta.json();

      if (!data.cae) {
        return {
          ok: false,
          error: data.error ?? 'ARCA no autorizó el comprobante',
          observaciones: data.observaciones,
          reintentable: false,
        };
      }

      return {
        ok: true,
        cae: data.cae,
        caeVencimiento: data.cae_vencimiento,
        numero: data.numero,
        qrDatos: data.qr ?? this.armarQR(d, data),
      };
    } catch (e) {
      const esTimeout = e instanceof Error && e.name === 'TimeoutError';
      return {
        ok: false,
        error: esTimeout
          ? 'El servicio de facturación no respondió a tiempo'
          : e instanceof Error
            ? e.message
            : 'Error de conexión',
        reintentable: true,
      };
    }
  }

  async ultimoNumero(puntoVenta: number, tipo: string): Promise<number> {
    const r = await fetch(
      `${this.baseUrl}/ultimo-comprobante?punto_venta=${puntoVenta}&tipo=${tipo}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    const data = await r.json();
    return data.numero ?? 0;
  }

  async estado() {
    try {
      const r = await fetch(`${this.baseUrl}/status`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return { disponible: r.ok };
    } catch {
      return { disponible: false, mensaje: 'Sin respuesta del servicio' };
    }
  }

  /**
   * QR obligatorio en el comprobante impreso.
   * Formato: https://www.afip.gob.ar/fe/qr/?p=<json en base64>
   */
  private armarQR(d: DatosComprobante, data: any): string {
    const payload = {
      ver: 1,
      fecha: d.fecha.toISOString().slice(0, 10),
      cuit: Number(this.cuit),
      ptoVta: d.puntoVenta,
      tipoCmp: COD_COMPROBANTE[d.tipo],
      nroCmp: data.numero,
      importe: d.total,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: d.receptor.docTipo,
      nroDocRec: Number(d.receptor.docNro) || 0,
      tipoCodAut: 'E',
      codAut: Number(data.cae),
    };

    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
  }
}