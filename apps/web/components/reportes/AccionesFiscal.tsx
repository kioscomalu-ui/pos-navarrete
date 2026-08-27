'use client';

interface FilaFiscal {
  dia: string;
  sucursal: string;
  sucursal_codigo: string;
  punto_venta: number;
  metodo: string;
  cantidad_ventas: number;
  total: number;
  neto_21: number;
  iva_21: number;
  neto_105: number;
  iva_105: number;
  neto_exento: number;
}

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  posnet: 'Tarjeta',
  billetera: 'Billetera',
  cuenta_corriente: 'Cta. corriente',
};

export function AccionesFiscal({
  filas,
  desde,
  hasta,
}: {
  filas: FilaFiscal[];
  desde: string;
  hasta: string;
}) {
  if (filas.length === 0) return null;

  function aCSV(): string {
    const cab =
      'fecha,sucursal,punto_venta,forma_cobro,neto_21,iva_21,neto_105,iva_105,exento,total';
    const cuerpo = filas
      .map((f) =>
        [
          f.dia,
          `"${f.sucursal}"`,
          f.punto_venta,
          ETIQUETA_METODO[f.metodo] ?? f.metodo,
          Number(f.neto_21).toFixed(2),
          Number(f.iva_21).toFixed(2),
          Number(f.neto_105).toFixed(2),
          Number(f.iva_105).toFixed(2),
          Number(f.neto_exento).toFixed(2),
          Number(f.total).toFixed(2),
        ].join(','),
      )
      .join('\n');
    return `${cab}\n${cuerpo}`;
  }

  function imprimir() {
    const filasHtml = filas
      .map((f, i) => {
        const cambioDia = i > 0 && filas[i - 1].dia !== f.dia;
        return `
          <tr${cambioDia ? ' style="border-top:2px solid #333"' : ''}>
            <td><input type="checkbox" /></td>
            <td>${f.dia.split('-').reverse().join('/')}</td>
            <td>${escapar(f.sucursal)}</td>
            <td style="text-align:right">${String(f.punto_venta).padStart(5, '0')}</td>
            <td>${ETIQUETA_METODO[f.metodo] ?? f.metodo}</td>
            <td style="text-align:right">${fmt(f.neto_21)}</td>
            <td style="text-align:right">${fmt(f.iva_21)}</td>
            <td style="text-align:right">${Number(f.neto_105) > 0 ? fmt(f.neto_105) : '-'}</td>
            <td style="text-align:right">${Number(f.iva_105) > 0 ? fmt(f.iva_105) : '-'}</td>
            <td style="text-align:right; font-weight:600">${fmt(f.total)}</td>
          </tr>`;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es-AR">
      <head>
        <meta charset="utf-8" />
        <title>Comprobantes a cargar en ARCA</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; }
          h1 { font-size: 16px; margin-bottom: 2px; }
          p { color: #666; margin-top: 0; margin-bottom: 16px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; border-bottom: 2px solid #1a1a1a; padding: 5px 6px;
               font-size: 10px; text-transform: uppercase; }
          td { border-bottom: 1px solid #ddd; padding: 5px 6px; }
          th:nth-child(n+6), th:nth-child(4) { text-align: right; }
        </style>
      </head>
      <body>
        <h1>Comprobantes a cargar en ARCA</h1>
        <p>
          Periodo ${desde.split('-').reverse().join('/')} al
          ${hasta.split('-').reverse().join('/')} ·
          ${filas.length} comprobantes ·
          Factura B a Consumidor Final
        </p>
        <table>
          <thead>
            <tr>
              <th style="width:24px"></th>
              <th>Fecha</th>
              <th>Sucursal</th>
              <th>Pto vta</th>
              <th>Cobro</th>
              <th>Neto 21%</th>
              <th>IVA 21%</th>
              <th>Neto 10,5%</th>
              <th>IVA 10,5%</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
      </body>
      </html>`;

    const v = window.open('', '_blank');
    if (!v) return;
    v.document.write(html);
    v.document.close();
    v.focus();
    v.print();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={imprimir}
        className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
      >
        Imprimir planilla
      </button>

      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(aCSV())}`}
        download={`arca-${desde}-a-${hasta}.csv`}
        className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
      >
        Descargar CSV
      </a>
    </div>
  );
}

function fmt(n: number | string): string {
  return Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}