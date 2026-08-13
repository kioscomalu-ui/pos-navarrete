'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { VentaEngine, type EstadoCarrito } from '@/lib/venta-engine';
import {
  catalogo,
  sincronizarCatalogo,
  cargarCatalogoLocal,
} from '@/lib/catalogo-cache';
import { purgarLocal, type CajaLocal } from '@/lib/db-local';
import {
  cajaAbierta,
  abrirCaja,
  cerrarCaja,
  type DeclaracionCierre,
} from '@/lib/caja-manager';
import { iniciarSync, pendientes } from '@/lib/cola-sync';
import { supabase } from '@/lib/supabase';

interface Props {
  sucursalId: string;
  vendedorId: string;
  codigoSucursal: string;
  puntoVenta: number;
}

export function useCaja({
  sucursalId,
  vendedorId,
  codigoSucursal,
  puntoVenta,
}: Props) {
  const engine = useMemo(
    () => new VentaEngine(sucursalId, vendedorId, codigoSucursal, puntoVenta),
    [sucursalId, vendedorId, codigoSucursal, puntoVenta],
  );

  const [carrito, setCarrito] = useState<EstadoCarrito>(engine.estado());
  const [listo, setListo] = useState(false);
  const [infoCarga, setInfoCarga] = useState('');
  const [online, setOnline] = useState(true);
  const [enCola, setEnCola] = useState(0);

  const [caja, setCaja] = useState<CajaLocal | null>(null);
  const [buscandoCaja, setBuscandoCaja] = useState(true);

  useEffect(() => {
    void cajaAbierta(vendedorId).then((c) => {
      setCaja(c);
      setBuscandoCaja(false);
    });
  }, [vendedorId]);

  const abrir = useCallback(async (efectivoInicial: number) => {
    const nueva = await abrirCaja(vendedorId, sucursalId, efectivoInicial);
    setCaja(nueva);
  }, [vendedorId, sucursalId]);

  const cerrar = useCallback(async (d: DeclaracionCierre) => {
    if (!caja) return;
    await cerrarCaja(caja, d);
    setCaja(null);
  }, [caja]);

  // ---- Suscripción al carrito ----
  useEffect(() => engine.suscribir(setCarrito), [engine]);

  // ---- Apertura de caja ----
  useEffect(() => {
    let activo = true;

    (async () => {
      // 1. Arrancar con el catálogo local: funciona aunque no haya internet
      let hayLocal = false;
      try {
        const locales = await cargarCatalogoLocal();
        hayLocal = locales > 0;
        if (activo && hayLocal) {
          setListo(true);
          setInfoCarga(`${locales} artículos (local)`);
        }
      } catch (e) {
        console.error('Error cargando catálogo local', e);
      }

      // 2. Purgar ventas viejas ya sincronizadas
      try {
        const purgadas = await purgarLocal(45);
        if (purgadas > 0) console.info(`Purga local: ${purgadas} ventas`);
      } catch (e) {
        console.error('Error en purga local', e);
      }

      // 3. Refrescar desde el servidor si hay conexión
      if (navigator.onLine) {
        try {
          const r = await sincronizarCatalogo(supabase, sucursalId);
          if (activo) {
            setListo(true);
            setInfoCarga(`${r.articulos} artículos · ${r.ms} ms`);
          }
        } catch (e) {
          console.error('Error sincronizando catálogo', e);
          if (activo && !hayLocal) {
            setInfoCarga('Sin catálogo local ni conexión al servidor');
          }
        }
      } else if (activo && !hayLocal) {
        setInfoCarga('Sin conexión y sin catálogo descargado');
      }
    })();

    return () => {
      activo = false;
    };
  }, [sucursalId]);

  // ---- Conexión y cola de sincronización ----
  useEffect(() => {
    setOnline(navigator.onLine);

    const alConectar = () => setOnline(true);
    const alDesconectar = () => setOnline(false);

    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);

    const detenerSync = iniciarSync();

    const intervalo = setInterval(async () => {
      try {
        setEnCola(await pendientes());
      } catch {
        // La cuenta de pendientes no es crítica
      }
    }, 3000);

    return () => {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
      detenerSync();
      clearInterval(intervalo);
    };
  }, []);

 return {
    engine, carrito, listo, infoCarga, online, enCola, catalogo,
    caja, buscandoCaja, abrir, cerrar,
  };
}