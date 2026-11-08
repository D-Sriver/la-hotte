// Service worker de La Hotte : affiche les notifications et ouvre l'app au toucher.
// Hors connexion : une page « Pas de connexion » plutôt que l'erreur du navigateur.
const CACHE = 'la-hotte-v2';
const OFFLINE = '/offline'; // Pages sert offline.html à cette adresse (sans redirection)
const OFFLINE_ASSETS = [OFFLINE, '/icon.svg'];

// Mise en cache sans jamais bloquer l'installation (connexion expirée, réseau instable…).
async function cacheOfflinePage() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    OFFLINE_ASSETS.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        if (response.ok && !response.redirected) await cache.put(url, response);
      } catch {
        /* on réessaiera à la prochaine installation */
      }
    }),
  );
}

self.addEventListener('install', (event) => event.waitUntil(cacheOfflinePage().then(() => self.skipWaiting())));
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

// Seules les navigations passent par ici : l'API et les fichiers vont directement au réseau.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
  } else if (
    OFFLINE_ASSETS.includes(new URL(request.url).pathname) &&
    new URL(request.url).origin === self.location.origin
  ) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || Response.error()));
  }
});

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'La Hotte', {
      body: message.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: message.tag,
      data: { url: message.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
