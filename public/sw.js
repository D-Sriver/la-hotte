// Service worker de La Hotte : affiche les notifications et ouvre l'app au toucher.
// Hors connexion : l'application elle-même (page et fichiers déjà chargés) reste disponible, et les données
// sont reprises de l'appareil par api.js. Sans application en cache : la page « Pas de connexion ».
const CACHE = 'la-hotte-v3';
const SHELL = '/'; // la page de l'application, gardée à chaque visite réussie
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

// Réponse utilisable pour le hors-connexion : venue de La Hotte, sans redirection (connexion expirée).
const keepable = (response) => response.ok && !response.redirected && response.type === 'basic';

// Nouvelle version du site : on garde sa page, et on oublie les fichiers de l'ancienne
// (ceux de la nouvelle se remettent en cache au fil de la visite).
async function keepShell(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const previous = await cache.match(SHELL);
  if (previous && (await previous.text()) !== html) {
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.startsWith('/assets/')) await cache.delete(request);
    }
  }
  await cache.put(SHELL, response);
}

async function navigate(request) {
  try {
    const response = await fetch(request);
    // L'accueil de l'application (pas /liste/… ni /offline) : on garde sa dernière version.
    if (keepable(response) && new URL(request.url).pathname === '/') await keepShell(response.clone());
    return response;
  } catch {
    const path = new URL(request.url).pathname;
    const shell = path === '/' || path === '/index.html' ? await caches.match(SHELL) : null;
    return shell || (await caches.match(OFFLINE)) || Response.error();
  }
}

// Fichiers de l'application : leur nom change à chaque version, on peut les garder sans risque.
async function asset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (keepable(response)) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

// Seules les navigations et les fichiers de l'application passent par ici : l'API va directement au réseau.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request));
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
