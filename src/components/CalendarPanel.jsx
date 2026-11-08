import { useState } from 'react';
import { api } from '../api.js';
import { copyText } from '../share.js';
import Icon from './Icon.jsx';

// Les anniversaires de la famille dans son agenda : un lien d'abonnement, mis à jour tout seul.
export default function CalendarPanel({ token: initial, onChanged }) {
  const [token, setToken] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const feed = token ? `${window.location.host}/liste/agenda/${token}.ics` : '';

  async function change(enabled) {
    setBusy(true);
    setDone('');
    try {
      const { calendar_token: next } = await api.calendar(enabled);
      setToken(next);
      onChanged?.(next);
    } catch (err) {
      setDone(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tile section calendar-panel">
      <h2 className="section-title">Anniversaires dans ton agenda</h2>
      <p className="muted small">
        Abonne ton agenda une fois : les anniversaires de la famille s’y affichent, et les nouveaux arrivent tout seuls.
      </p>
      {token ? (
        <>
          <div className="share-actions">
            <a
              className="button button-small"
              href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${feed}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="cake" size={16} />
              Google Agenda
            </a>
            <a className="button button-small" href={`webcal://${feed}`}>
              <Icon name="cake" size={16} />
              iPhone ou Mac
            </a>
            <button
              className="button button-small button-quiet"
              disabled={busy}
              onClick={() =>
                copyText(`https://${feed}`).then(
                  () => setDone('Lien copié'),
                  () => setDone('Copie impossible'),
                )
              }
            >
              <Icon name="copy" size={16} />
              Copier le lien
            </button>
            <button className="button button-small button-quiet" disabled={busy} onClick={() => change(false)}>
              Couper le lien
            </button>
          </div>
          <p className="muted small calendar-note">
            Ce lien est personnel : qui l’a voit les dates d’anniversaire de ta famille, rien d’autre.
          </p>
        </>
      ) : (
        <button className="button button-small" disabled={busy} onClick={() => change(true)}>
          <Icon name="cake" size={16} />
          Créer le lien d’agenda
        </button>
      )}
      <span className="muted small" role="status">
        {done}
      </span>
    </section>
  );
}
