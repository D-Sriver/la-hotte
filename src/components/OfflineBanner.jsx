import { useEffect, useState } from 'react';
import { staleSince } from '../offline.js';

const when = (at) =>
  new Date(at).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

// Sans réseau (ou session expirée) : on montre la dernière version gardée sur l'appareil, et on le dit.
export default function OfflineBanner() {
  const [at, setAt] = useState(staleSince);
  useEffect(() => {
    const update = () => setAt(staleSince());
    window.addEventListener('la-hotte-stale', update);
    return () => window.removeEventListener('la-hotte-stale', update);
  }, []);
  if (!at) return null;
  return (
    <div className="offline-banner" role="status">
      <span>
        <strong>Hors connexion</strong> : tu vois la version du {when(at)}, en lecture seule.
      </span>
      <button className="button button-small button-quiet" onClick={() => window.location.reload()}>
        Réessayer
      </button>
    </div>
  );
}
