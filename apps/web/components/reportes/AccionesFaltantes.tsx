'use client';

import { useState } from 'react';

interface FilaFaltante {
  id: string;
  nombre: string;
  codigo_barras: string | null;
  proveedor: string | null;
  cantidad_disponible: number;
  stock_minimo: number;
  falta: number;
}

export function AccionesFaltantes({ filas }: { filas: FilaFaltante[] }) {
  const [copiado, setCopiado] = useState(false);

  async function copiarParaWhatsApp() {
    const fecha = new Date().toLocaleDateString('es-AR');
    const lineas = filas.map(
      (f) =>
        `• ${f.nombre}${f.proveedor ? ` (${f.proveedor})` : ''} — faltan ${Number(f.falta)}`,
    );

    const texto = `📋 Faltantes de stock — ${fecha}\n\n${lineas.join('\n')}`;

    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function imprimir() {
    const fecha = new Date().toLocaleDateString('es-AR');

    const filasHtml = filas
      .map(
        (f) => `
          <tr>
            <td>${escaparHtml(f.nombre)}</td>
            <td>${escaparHtml(f.proveedor ?? '—')}</td>
            <td style="text-align:right">${Number(f.cantidad_disponible)}</td>
            <td style="text-align:right">${Number(f.stock_minimo)}</td>
            <td style="text-align:right; font-weight:600">${Number(f.falta)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es-AR">
      <head>
        <meta charset="utf-8" />
        <title>Faltantes de stock — ${fecha}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 2px; }
          p { color: #666; margin-top: 0; margin-bottom: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; border-bottom: 2px solid #1a1a1a; padding: 6px 8px; }
          td { border-bottom: 1px solid #ddd; padding: 6px 8px; }
          th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
        </style>
      </head>
      <body>
        <h1>Faltantes de stock</h1>
        <p>${fecha} · ${filas.length} artículos</p>
        <table>
          <thead>
            <tr>
              <th>Artículo</th>
              <th>Proveedor</th>
              <th>Disponible</th>
              <th>Mínimo</th>
              <th>Faltan</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
      </body>
      </html>`;

    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  if (filas.length === 0) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={copiarParaWhatsApp}
        className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
      >
        {copiado ? 'Copiado ✓' : 'Copiar para WhatsApp'}
      </button>
      <button
        onClick={imprimir}
        className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
      >
        Imprimir
      </button>
    </div>
  );
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}