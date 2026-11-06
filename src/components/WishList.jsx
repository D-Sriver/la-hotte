import { useState } from 'react';
import { api } from '../api.js';

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

function WishRow({ wish, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const canDelete = wish.mine || wish.can_delete;
  const showReserve = !wish.mine && (!wish.reserved || wish.reserved_by_me);

  return (
    <li className={`wish${wish.reserved && !wish.reserved_by_me ? ' wish-taken' : ''}`}>
      <div className="wish-main">
        <p className="wish-title">
          {wish.url ? <a href={wish.url} target="_blank" rel="noopener noreferrer">{wish.title}</a> : wish.title}
        </p>
        <p className="wish-meta">
          {[wish.price, wish.url && hostOf(wish.url), wish.note].filter(Boolean).join(' – ')}
        </p>
        {wish.secret && <p className="wish-secret">Idée secrète de {wish.added_by_name}</p>}
        {wish.reserved && !wish.reserved_by_me && <p className="wish-status">Réservé par {wish.reserved_by_name}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="wish-actions">
        {showReserve && (
          <button
            className={`button button-small${wish.reserved_by_me ? ' button-done' : ''}`}
            disabled={busy}
            aria-pressed={wish.reserved_by_me}
            onClick={() => run(() => api.toggleReserve(wish.id))}
          >
            {wish.reserved_by_me ? 'Réservé par toi' : 'Je réserve'}
          </button>
        )}
        {canDelete && (
          <button
            className="link-button"
            disabled={busy}
            onClick={() => window.confirm(`Supprimer « ${wish.title} » ?`) && run(() => api.deleteWish(wish.id))}
          >
            Supprimer
          </button>
        )}
      </div>
    </li>
  );
}

export default function WishList({ wishes, emptyText, onChanged }) {
  if (!wishes.length) return <p className="muted">{emptyText}</p>;
  return (
    <ul className="wish-list">
      {wishes.map((w) => <WishRow key={w.id} wish={w} onChanged={onChanged} />)}
    </ul>
  );
}
