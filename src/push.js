import { api } from './api.js';

// Abonnement aux notifications sur cet appareil.

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const keyBytes = (base64url) => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

const sameKey = (buffer, publicKey) => {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
};

// S'abonne sur cet appareil et l'enregistre côté serveur. Un abonnement fait avec d'autres clés est refait.
async function subscribe(publicKey) {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options?.applicationServerKey, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await api.pushSubscribe(subscription.toJSON());
}

export async function enablePush(publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications refusées. Autorise-les pour La Hotte dans les réglages de l’appareil ou du navigateur.');
  }
  await subscribe(publicKey);
}

/**
 * Le navigateur se croit abonné, mais le serveur a pu perdre l'abonnement (expiré, clés changées) :
 * on le renvoie (ou on le refait) sans rien demander. Renvoie vrai si l'appareil est bien inscrit.
 */
export async function syncPush(publicKey) {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  if (!(await currentSubscription())) return false;
  await subscribe(publicKey);
  return true;
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api.pushUnsubscribe(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe();
}
