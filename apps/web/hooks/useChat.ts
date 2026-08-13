'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  canalesLocales,
  sincronizarCanales,
  mensajesLocales,
  sincronizarMensajes,
  enviarMensaje,
  noLeidosPorCanal,
  marcarLeido,
  desdeRemoto,
  type ContextoChat,
} from '@/lib/chat-manager';
import { dbLocal, type CanalLocal, type MensajeLocal } from '@/lib/db-local';

export function useChat(ctx: ContextoChat) {
  const [canales, setCanales] = useState<CanalLocal[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeLocal[]>([]);
  const [noLeidos, setNoLeidos] = useState<Map<string, number>>(new Map());

  // El canal activo en una ref, para usarlo dentro del callback de Realtime
  // sin que el efecto dependa de él y se re-suscriba
  const canalRef = useRef<string | null>(null);
  canalRef.current = canalActivo;

  // ---------------------------------------------------------------
  // Canales
  // ---------------------------------------------------------------
  useEffect(() => {
    let activo = true;

    (async () => {
      const locales = await canalesLocales();
      if (activo && locales.length) {
        setCanales(locales);
        setCanalActivo((a) => a ?? locales[0].id);
      }

      if (navigator.onLine) {
        try {
          const remotos = await sincronizarCanales();
          if (activo) {
            setCanales(remotos);
            setCanalActivo((a) => a ?? remotos[0]?.id ?? null);
          }
        } catch {
          // Sin conexión: seguimos con los canales locales
        }
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  // ---------------------------------------------------------------
  // Mensajes del canal activo
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!canalActivo) return;
    let activo = true;

    (async () => {
      // 1. Lo que ya está en el dispositivo: instantáneo
      const locales = await mensajesLocales(canalActivo);
      if (activo) setMensajes(locales);

      // 2. Lo que falta desde el servidor
      if (navigator.onLine) {
        try {
          const nuevos = await sincronizarMensajes(canalActivo);
          if (activo && nuevos > 0) {
            setMensajes(await mensajesLocales(canalActivo));
          }
        } catch {
          // Sin conexión
        }
      }
    })();

    return () => {
      activo = false;
    };
  }, [canalActivo]);

  // ---------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!canalActivo) return;

    const nombre = `chat:${canalActivo}`;

    // En desarrollo React monta dos veces y el hot reload deja
    // suscripciones colgadas: limpiar antes de crear la nueva
    for (const previo of supabase.getChannels()) {
      if (previo.topic === `realtime:${nombre}`) {
        void supabase.removeChannel(previo);
      }
    }

    const suscripcion = supabase
      .channel(nombre)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensajes',
          filter: `canal_id=eq.${canalActivo}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') return;

          const m = desdeRemoto(payload.new);
          await dbLocal.mensajes.put(m);

          // Solo refrescar si sigue siendo el canal que está a la vista
          if (canalRef.current === m.canalId) {
            setMensajes(await mensajesLocales(m.canalId));
          }
          setNoLeidos(await noLeidosPorCanal(ctx.usuarioId));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(suscripcion);
    };
  }, [canalActivo, ctx.usuarioId]);

  // ---------------------------------------------------------------
  // No leídos
  // ---------------------------------------------------------------
  useEffect(() => {
    let activo = true;

    const actualizar = async () => {
      const mapa = await noLeidosPorCanal(ctx.usuarioId);
      if (activo) setNoLeidos(mapa);
    };

    void actualizar();
    const intervalo = setInterval(() => void actualizar(), 5000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [ctx.usuarioId]);

  // ---------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------
  const refrescar = useCallback(async () => {
    if (canalActivo) setMensajes(await mensajesLocales(canalActivo));
    setNoLeidos(await noLeidosPorCanal(ctx.usuarioId));
  }, [canalActivo, ctx.usuarioId]);

  const enviar = useCallback(
    async (contenido: string) => {
      if (!canalActivo) return;
      await enviarMensaje(ctx, canalActivo, contenido);
      setMensajes(await mensajesLocales(canalActivo));
    },
    [canalActivo, ctx],
  );

  const abrirCanal = useCallback(
    async (canalId: string) => {
      setCanalActivo(canalId);
      await marcarLeido(canalId);
      setCanales(await canalesLocales());
      setNoLeidos(await noLeidosPorCanal(ctx.usuarioId));
    },
    [ctx.usuarioId],
  );

  const totalNoLeidos = [...noLeidos.values()].reduce((a, b) => a + b, 0);

  return {
    canales,
    canalActivo,
    mensajes,
    noLeidos,
    totalNoLeidos,
    enviar,
    abrirCanal,
    refrescar,
  };
}