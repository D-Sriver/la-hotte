import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { burst } from '../fun.js';

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
  const host = wish.url && hostOf(wish.url);
  const taken = wish.reserved && !wish.reserved_by_me;

  return (
    <li className={`wish${taken ? ' wish-taken' : ''}`}>
      {wish.has_photo ? (
        <a className="wish-thumb wish-photo" href={api.photoUrl(wish.id)} target="_blank" rel="noopener noreferrer" aria-label={`Voir la photo de « ${wish.title} »`}>
          <img src={api.photoUrl(wish.id)} alt="" loading="lazy" />
        </a>
      ) : (
        <span className="wish-thumb"><Icon name={wish.url ? 'link' : 'gift'} size={20} /></span>
      )}
      <div className="wish-main">
        <p className="wish-title">
          {wish.url ? <a href={wish.url} target="_blank" rel="noopener noreferrer">{wish.title}</a> : wish.title}
        </p>
        <p className="wish-meta">
          {wish.price && <span className="price">{wish.price}</span>}
          {[host, wish.note].filter(Boolean).join(', ')}
        </p>
        {(wish.secret || taken) && (
          <p className="badges">
            {wish.secret && <span className="badge badge-secret"><Icon name="lock" size={13} />Idée secrète de {wish.added_by_name}</span>}
            {taken && <span className="badge badge-taken"><Icon name="check" size={13} />Réservé par {wish.reserved_by_name}</span>}
          </p>
        )}
        {error && <p className="error small" role="alert">{error}</p>}
      </div>
      <div className="wish-actions">
        {showReserve && (
          <button
            className={`button button-small${wish.reserved_by_me ? ' button-done' : ''}`}
            disabled={busy}
            aria-pressed={wish.reserved_by_me}
            onClick={(e) => {
              if (!wish.reserved_by_me) burst(e.currentTarget);
              run(() => api.toggleReserve(wish.id));
            }}
          >
            {wish.reserved_by_me ? <><Icon name="check" size={16} />C’est moi qui offre</> : 'Je réserve'}
          </button>
        )}
        {canDelete && (
          <button
            className="icon-button"
            disabled={busy}
            aria-label={`Supprimer « ${wish.title} »`}
            onClick={() => window.confirm(`Supprimer « ${wish.title} » ?`) && run(() => api.deleteWish(wish.id))}
          >
            <Icon name="trash" size={18} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function WishList({ wishes, emptyText, onChanged }) {
  if (!wishes.length) return <p className="empty-inline">{emptyText}</p>;
  return (
    <ul className="wish-list">
      {wishes.map((w) => <WishRow key={w.id} wish={w} onChanged={onChanged} />)}
    </ul>
  );
}
