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

/** Formatos equivalentes para la API nativa BarcodeDetector (Safari 17+) */
const FORMATOS_NATIVOS = [
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'upc_a',
  'upc_e',
];

type Estado = 'inicial' | 'activando' | 'activa' | 'error';

export function EscanerCamara({ onCodigo, onCerrar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const zxingControlesRef = useRef<{ stop: () => void } | null>(null);

  const [estado, setEstado] = useState<Estado>('inicial');
  const [error, setError] = useState('');
  const [ultimo, setUltimo] = useState('');

  useEffect(() => {
    // Frenar todo al desmontar: sin esto, el ícono de cámara activa
    // queda prendido en iOS aunque se haya cerrado la pantalla.
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      zxingControlesRef.current?.stop();
    };
  }, []);

  function reportarCodigo(codigo: string) {
    // Vibración corta como confirmación táctil de que se leyó algo
    navigator.vibrate?.(50);
    setUltimo(codigo);
    onCodigo(codigo);
  }

  /**
   * El pedido de cámara arranca acá, dentro del manejador de un clic
   * real del usuario. Safari en iOS es más estricto que Chrome: si el
   * pedido llega desde un useEffect al montar el componente, a veces
   * lo bloquea en silencio. Pegarlo al toque evita esa duda.
   */
  async function activar() {
    setEstado('activando');
    setError('');

    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: 'environment' } },
    };

    try {
      // --- Camino rápido: BarcodeDetector nativo (Safari 17+, Chrome/Android) ---
      if ('BarcodeDetector' in window) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();

        // @ts-expect-error — BarcodeDetector todavía no está en los tipos de TS
        const detector = new window.BarcodeDetector({ formats: FORMATOS_NATIVOS });

        let ultimoCodigo = '';
        let ultimoMomento = 0;

        const detectar = async () => {
          if (!video.current) return;
          try {
            const resultados = await detector.detect(video.current);
            if (resultados.length > 0) {
              const codigo = resultados[0].rawValue;
              const ahora = Date.now();
              if (!(codigo === ultimoCodigo && ahora - ultimoMomento < 2000)) {
                ultimoCodigo = codigo;
                ultimoMomento = ahora;
                reportarCodigo(codigo);
              }
            }
          } catch {
            // Un frame fallido no es un error: seguir intentando
          }
          rafRef.current = requestAnimationFrame(detectar);
        };

        setEstado('activa');
        detectar();
        return;
      }

      // --- Respaldo: ZXing, para versiones de iOS/Safari sin BarcodeDetector ---
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS);
      const lector = new BrowserMultiFormatReader(hints);

      let ultimoCodigo = '';
      let ultimoMomento = 0;

      const controles = await lector.decodeFromConstraints(
        constraints,
        video.current!,
        (resultado) => {
          if (!resultado) return;
          const codigo = resultado.getText();
          const ahora = Date.now();
          if (codigo === ultimoCodigo && ahora - ultimoMomento < 2000) return;
          ultimoCodigo = codigo;
          ultimoMomento = ahora;
          reportarCodigo(codigo);
        },
      );

      zxingControlesRef.current = controles;
      streamRef.current = (video.current?.srcObject as MediaStream) ?? null;

      setEstado('activa');
    } catch (e) {
      setEstado('error');
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Hay que dar permiso para usar la cámara'
          : e instanceof Error && e.name === 'NotFoundError'
            ? 'No se encontró ninguna cámara'
            : 'No se pudo acceder a la cámara',
      );
    }
  }

  function cerrar() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    zxingControlesRef.current?.stop();
    onCerrar();
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">Apuntá al código de barras</span>
        <button onClick={cerrar} className="text-2xl leading-none px-2">
          ×
        </button>
      </div>

      <div className="flex-1 relative">
        <video
          ref={video}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted
        />

        {/* Guía visual */}
        {estado === 'activa' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-40 border-2 border-white/70 rounded-lg" />
          </div>
        )}

        {/* Pantalla inicial: activación explícita por toque.
            Necesario en iOS para que el pedido de cámara quede
            pegado al gesto del usuario, sin pasar por un efecto. */}
        {estado === 'inicial' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <button
              onClick={activar}
              className="bg-white rounded-lg px-6 py-4 text-center"
            >
              <div className="text-3xl mb-2">📷</div>
              <div className="font-medium">Activar cámara</div>
            </button>
          </div>
        )}

        {estado === 'activando' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white text-sm">Abriendo cámara…</p>
          </div>
        )}

        {estado === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-white rounded-lg px-4 py-4 text-sm text-center space-y-3 max-w-xs">
              <p>{error}</p>
              <p className="text-xs text-neutral-500">
                Si es la primera vez, probá abrir el sitio en Safari (no desde
                el ícono instalado) y dar el permiso de cámara ahí.
              </p>
              <button
                onClick={activar}
                className="text-sm font-medium text-blue-600"
              >
                Reintentar
              </button>
            </div>
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