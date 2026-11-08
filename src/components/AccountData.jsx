import { useState } from 'react';
import { api } from '../api.js';
import { forgetAll } from '../offline.js';
import Icon from './Icon.jsx';

// Mes données : les télécharger, ou supprimer mon compte (retaper son prénom pour confirmer).
export default function AccountData({ me }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState({ busy: false, error: '' });

  async function remove(e) {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      await api.deleteAccount(typed);
      forgetAll();
      if (me.email_login) await api.logout().catch(() => {});
      window.location.href = me.email_login ? '/' : '/cdn-cgi/access/logout';
    } catch (err) {
      setStatus({ busy: false, error: err.message });
    }
  }

  return (
    <div className="account-data">
      <a className="button button-quiet" href={api.dataUrl()} download="la-hotte-mes-donnees.json">
        <Icon name="download" size={18} />
        Télécharger mes données
      </a>
      {!confirming ? (
        <button className="button button-quiet account-delete" onClick={() => setConfirming(true)}>
          <Icon name="trash" size={18} />
          Supprimer mon compte
        </button>
      ) : (
        <form className="confirm-group account-confirm" onSubmit={remove}>
          <p>
            <strong>Supprimer ton compte ?</strong> Ta liste, ton profil, tes idées secrètes pour les autres et tes
            messages disparaissent pour de bon. Ce que tu avais réservé redevient libre pour la famille ; tes cagnottes
            passent au participant suivant.
          </p>
          <label htmlFor="confirm-name">Tape « {me.name} » pour confirmer</label>
          <input id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          <div className="share-actions">
            <button
              className="button button-small button-danger"
              disabled={status.busy || typed.trim().toLowerCase() !== me.name.trim().toLowerCase()}
            >
              Supprimer définitivement
            </button>
            <button
              type="button"
              className="button button-small button-quiet"
              onClick={() => {
                setConfirming(false);
                setTyped('');
              }}
            >
              Non, garder mon compte
            </button>
          </div>
          {status.error && (
            <p className="error small" role="alert">
              {status.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
