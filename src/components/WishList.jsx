import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import WishForm from './WishForm.jsx';
import { burst } from '../fun.js';

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const names = (people) => people.map((p) => p.name).join(', ');

// Les boutons pour offrir le cadeau de quelqu'un d'autre, selon où il en est.
function GiftActions({ wish, busy, run }) {
  const act = (action, celebrate) => (e) => {
    if (celebrate) burst(e.currentTarget);
    run(() => api.gift(wish.id, action));
  };
  const boughtButton = (
    <button
      className={`button button-small button-quiet${wish.bought ? ' button-bought' : ''}`}
      disabled={busy}
      aria-pressed={wish.bought}
      onClick={act('bought', !wish.bought)}
    >
      <Icon name={wish.bought ? 'check' : 'bag'} size={16} />{wish.bought ? 'Acheté' : 'Marquer acheté'}
    </button>
  );

  if (!wish.reserved) {
    return (
      <>
        <button className="button button-small button-go" disabled={busy} onClick={act('reserve', true)}>Je réserve</button>
        <button className="button button-small button-quiet" disabled={busy} onClick={act('group', true)}>
          <Icon name="family" size={16} />À plusieurs
        </button>
      </>
    );
  }
  if (wish.group_gift) {
    return wish.participating ? (
      <>
        {boughtButton}
        <button className="button button-small button-quiet" disabled={busy} onClick={act('leave')}>Je me retire</button>
      </>
    ) : (
      <button className="button button-small button-go" disabled={busy} onClick={act('join', true)}>
        <Icon name="plus" size={16} />Je participe
      </button>
    );
  }
  if (wish.reserved_by_me) {
    return (
      <>
        {boughtButton}
        <button className="button button-small button-done" disabled={busy} aria-pressed="true" onClick={act('reserve')}>
          <Icon name="check" size={16} />C’est moi qui offre
        </button>
      </>
    );
  }
  return null;
}

function WishRow({ wish, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="wish-editing">
        <WishForm
          wish={wish}
          forSomeoneElse={!wish.mine}
          onDone={() => { setEditing(false); onChanged(); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const canDelete = wish.mine || wish.can_delete;
  const host = wish.url && hostOf(wish.url);
  // Grisé seulement quand il n'y a plus rien à faire pour moi dessus.
  const taken = wish.reserved && !wish.reserved_by_me && !(wish.group_gift);

  return (
    <li className={`wish${taken ? ' wish-taken' : ''}${wish.favorite ? ' wish-favorite' : ''}`}>
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
        {(wish.favorite || wish.secret || wish.reserved || wish.bought) && (
          <p className="badges">
            {wish.favorite && <span className="badge badge-favorite"><Icon name="star" size={13} />Coup de cœur</span>}
            {wish.secret && <span className="badge badge-secret"><Icon name="lock" size={13} />Idée secrète de {wish.added_by_name}</span>}
            {wish.group_gift && <span className="badge badge-group"><Icon name="family" size={13} />À plusieurs : {names(wish.participants)}</span>}
            {taken && <span className="badge badge-taken"><Icon name="check" size={13} />Réservé par {wish.reserved_by_name}</span>}
            {wish.bought && <span className="badge badge-bought"><Icon name="bag" size={13} />Acheté</span>}
          </p>
        )}
        {error && <p className="error small" role="alert">{error}</p>}
      </div>
      <div className="wish-actions">
        {!wish.mine && <GiftActions wish={wish} busy={busy} run={run} />}
        {wish.can_edit && (
          <button className="icon-button" disabled={busy} aria-label={`Modifier « ${wish.title} »`} onClick={() => setEditing(true)}>
            <Icon name="pencil" size={18} />
          </button>
        )}
        {canDelete && (
          <button
            className="icon-button icon-button-danger"
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
