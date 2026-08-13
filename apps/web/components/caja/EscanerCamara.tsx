'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

interface Props {
  onCodigo: (codigo: string) => void;
  onCerrar: () => void;
}

const FORMATOS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

export function EscanerCamara({ onCodigo, onCerrar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [ultimo, setUltimo] = useState('');

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS);

    const lector = new BrowserMultiFormatReader(hints);
    let controles: { stop: () => void } | null = null;
    let ultimoCodigo = '';
    let ultimoMomento = 0;

    (async () => {
      try {
        controles = await lector.decodeFromVideoDevice(
          undefined,          // cámara por defecto (trasera en celular)
          video.current!,
          (resultado) => {
            if (!resultado) return;

            const codigo = resultado.getText();
            const ahora = Date.now();

            // Evitar leer el mismo código repetido mientras la cámara lo enfoca
            if (codigo === ultimoCodigo && ahora - ultimoMomento < 2000) return;

            ultimoCodigo = codigo;
            ultimoMomento = ahora;

            // Vibración corta como confirmación
            navigator.vibrate?.(50);
            setUltimo(codigo);
            onCodigo(codigo);
          },
        );
      } catch (e) {
        setError(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Hay que dar permiso para usar la cámara'
            : 'No se pudo acceder a la cámara',
        );
      }
    })();

    return () => {
      controles?.stop();
    };
  }, [onCodigo]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">Apuntá al código de barras</span>
        <button onClick={onCerrar} className="text-2xl leading-none px-2">
          ×
        </button>
      </div>

      <div className="flex-1 relative">
        <video
          ref={video}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Guía visual */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-40 border-2 border-white/70 rounded-lg" />
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="bg-white rounded-lg px-4 py-3 text-sm text-center">
              {error}
            </p>
          </div>
        )}
      </div>

      {ultimo && (
        <p className="text-center text-white/70 text-sm font-mono py-3">
          {ultimo}
        </p>
      )}
    </div>
  );
}