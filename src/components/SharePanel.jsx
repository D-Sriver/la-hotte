import { useState } from 'react';
import { api } from '../api.js';
import { copyText } from '../share.js';
import Icon from './Icon.jsx';

// Partager sa liste avec quelqu'un hors de la famille (un parrain, un ami) : un lien en lecture seule,
// sans compte, sans réservations. On peut le changer (l'ancien ne marche plus) ou le couper.
export default function SharePanel({ token: initial }) {
  const [token, setToken] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const link = token ? `${window.location.origin}/liste/${token}` : '';

  async function change(enabled) {
    setBusy(true);
    setDone('');
    try {
      const { share_token: next } = await api.shareList(enabled);
      setToken(next);
      if (next)
        await copyText(`${window.location.origin}/liste/${next}`).then(
          () => setDone('Lien copié'),
          () => {},
        );
    } catch (err) {
      setDone(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tile section share-panel">
      <h2 className="section-title">Hors de la famille</h2>
      <p className="muted small">
        Un lien vers ta liste pour quelqu’un qui n’est pas dans La Hotte. Il voit tes envies, mais ni les réservations
        ni les idées secrètes, et ne peut rien réserver.
      </p>
      {token ? (
        <>
          <p className="share-link num">{link}</p>
          <div className="share-actions">
            <button
              className="button button-small"
              disabled={busy}
              onClick={() =>
                copyText(link).then(
                  () => setDone('Lien copié'),
                  () => setDone('Copie impossible'),
                )
              }
            >
              <Icon name="copy" size={16} />
              Copier le lien
            </button>
            <button className="button button-small button-quiet" disabled={busy} onClick={() => change(true)}>
              Changer de lien
            </button>
            <button className="button button-small button-quiet" disabled={busy} onClick={() => change(false)}>
              Couper le lien
            </button>
          </div>
        </>
      ) : (
        <button className="button button-small" disabled={busy} onClick={() => change(true)}>
          <Icon name="share" size={16} />
          Créer un lien de partage
        </button>
      )}
      <span className="muted small" role="status">
        {done}
      </span>
    </section>
  );
}
