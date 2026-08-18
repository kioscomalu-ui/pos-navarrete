const CACHE = 'navarrete-v4';

// Al instalar, tomar el control enseguida
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Al activar, limpiar versiones viejas del caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca cachear llamadas a Supabase: los datos van por IndexedDB
  if (url.hostname.endsWith('.supabase.co')) return;

  // Solo nuestro propio origen
  if (url.origin !== self.location.origin) return;

  // Páginas: intentar red, caer al caché si no hay
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const respuesta = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, respuesta.clone());
          return respuesta;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request)) ??
            (await cache.match('/caja')) ??
            new Response('Sin conexión', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  // Assets: caché primero, red como respaldo
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const enCache = await cache.match(request);
      if (enCache) return enCache;

      try {
        const respuesta = await fetch(request);
        if (respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
      } catch {
        return new Response('', { status: 504 });
      }
    })(),
  );
});