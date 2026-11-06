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

export async function enablePush(publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications refusées. Autorise-les pour La Hotte dans les réglages du téléphone ou du navigateur.');
  }
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await api.pushSubscribe(subscription.toJSON());
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api.pushUnsubscribe(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe();
}
