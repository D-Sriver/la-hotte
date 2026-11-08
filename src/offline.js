// Lecture hors connexion : la dernière réponse des écrans de lecture (accueil, listes, ce que j'offre)
// est gardée sur cet appareil. Sans réseau, on la ressert et on prévient que c'est l'ancienne version.
// Seulement sur l'appareil de la personne connectée, effacé à la déconnexion ou si un autre compte s'y connecte.
const PREFIX = 'la-hotte-data:';
const READABLE = /^\/(me|people|people\/\d+|reservations)$/;

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

// Sur un appareil partagé, rien n'est gardé (voir sharedDevice.js).
const sharedDevice = () => {
  try {
    return window.localStorage.getItem('la-hotte-shared-device') === '1';
  } catch {
    return false;
  }
};

export const canKeep = (path, method) => method === 'GET' && READABLE.test(path) && !sharedDevice();

export function keep(familyId, path, data) {
  const store = storage();
  if (!store) return;
  try {
    // Un autre compte sur cet appareil : on oublie tout ce qui venait du précédent.
    if (path === '/me' && data?.me?.id) {
      const owner = store.getItem(`${PREFIX}owner`);
      if (owner && owner !== String(data.me.id)) forgetAll();
      store.setItem(`${PREFIX}owner`, String(data.me.id));
    }
    store.setItem(`${PREFIX}${familyId || 0}:${path}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* stockage plein ou refusé : tant pis pour le hors-connexion */
  }
}

export function recall(familyId, path) {
  try {
    const raw = storage()?.getItem(`${PREFIX}${familyId || 0}:${path}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function forgetAll() {
  const store = storage();
  if (!store) return;
  try {
    for (const key of Object.keys(store)) if (key.startsWith(PREFIX)) store.removeItem(key);
  } catch {
    /* rien à effacer */
  }
}

// Prévient l'interface qu'on affiche une ancienne version (date de la dernière mise à jour), ou que c'est fini.
let staleAt = null;
export const staleSince = () => staleAt;
export function announceStale(at) {
  staleAt = Math.min(staleAt ?? at, at);
  window.dispatchEvent(new Event('la-hotte-stale'));
}
export function announceFresh() {
  if (staleAt === null) return;
  staleAt = null;
  window.dispatchEvent(new Event('la-hotte-stale'));
}
