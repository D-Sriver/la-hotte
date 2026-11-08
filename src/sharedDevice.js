import { useCallback, useEffect, useState } from 'react';

// Appareil partagé (l'iPad du salon) : à chaque ouverture, et après quelques minutes sans s'en servir,
// La Hotte demande « C'est bien toi ? » avant de montrer quoi que ce soit. Et rien n'est gardé pour le
// hors-connexion : les réservations des uns ne restent pas sur l'appareil des autres.
// Réglage propre à l'appareil (pas au compte).
const SHARED = 'la-hotte-shared-device';
const UNLOCKED = 'la-hotte-unlocked-at';
const IDLE_MS = 5 * 60_000;

const read = (store, key) => {
  try {
    return window[store].getItem(key);
  } catch {
    return null;
  }
};
const write = (store, key, value) => {
  try {
    if (value === null) window[store].removeItem(key);
    else window[store].setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
};

export const isSharedDevice = () => read('localStorage', SHARED) === '1';
export function setSharedDevice(on) {
  write('localStorage', SHARED, on ? '1' : null);
  // La personne qui active le réglage est déjà là : on ne la verrouille pas tout de suite.
  if (on) write('sessionStorage', UNLOCKED, String(Date.now()));
}

const recentlyUnlocked = () => Date.now() - Number(read('sessionStorage', UNLOCKED) || 0) < IDLE_MS;

// locked : faut-il montrer l'écran « C'est bien toi ? ». unlock : la personne a confirmé.
export function useDeviceLock() {
  const [locked, setLocked] = useState(() => isSharedDevice() && !recentlyUnlocked());

  const unlock = useCallback(() => {
    write('sessionStorage', UNLOCKED, String(Date.now()));
    setLocked(false);
  }, []);

  useEffect(() => {
    if (!isSharedDevice()) return undefined;
    // Chaque geste repousse le verrouillage ; au retour sur l'onglet après 5 minutes, on redemande.
    const touch = () => !locked && write('sessionStorage', UNLOCKED, String(Date.now()));
    const check = () => {
      if (document.visibilityState === 'visible' && !recentlyUnlocked()) setLocked(true);
    };
    const timer = setInterval(check, 30_000);
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', check);
    };
  }, [locked]);

  return { locked, unlock };
}
