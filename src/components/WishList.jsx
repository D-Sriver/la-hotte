import { useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import WishForm from './WishForm.jsx';
import { burst, toneOf } from '../fun.js';
import { gsap, MOTION_OK, useStagger } from '../motion.js';

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

const euros = (n) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Où en est la cagnotte d'un cadeau à plusieurs : qui met combien, et la barre vers le prix.
function GroupProgress({ wish, children }) {
  const ratio = wish.target ? Math.min(1, wish.collected / wish.target) : 0;
  const missing = wish.target ? Math.max(0, wish.target - wish.collected) : null;
  return (
    <div className={`group-progress${wish.target && wish.collected >= wish.target ? ' group-done' : ''}`}>
      {wish.target ? (
        <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={wish.target} aria-valuenow={wish.collected}
            aria-label={`${euros(wish.collected)} réunis sur ${euros(wish.target)}`}>
            <span style={{ transform: `scaleX(${ratio})` }} />
          </div>
          <p className="progress-text num">
            <strong>{euros(wish.collected)}</strong> sur {euros(wish.target)}
            {missing > 0 ? `, il manque ${euros(missing)}` : ', c’est bouclé 🎉'}
          </p>
        </>
      ) : (
        <p className="progress-text num"><strong>{euros(wish.collected)}</strong> réunis (pas de prix indiqué)</p>
      )}
      <ul className="chips" aria-label="Participants">
        {wish.participants.map((p) => (
          <li key={p.id} className="chip">
            <span className={`chip-dot tone-${toneOf(p.id)}`} aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
            {p.name}
            <strong className="num">{p.amount ? euros(p.amount) : '?'}</strong>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

// « Ma part : [ 50 ] € » pour un participant.
function MyAmount({ wish, busy, run }) {
  const initial = wish.my_amount == null ? '' : String(wish.my_amount).replace('.', ',');
  const [value, setValue] = useState(initial);
  const suggested = wish.target ? Math.max(0, wish.target - (wish.collected - (wish.my_amount || 0))) : null;
  const changed = value !== initial;
  return (
    <form
      className="my-amount"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = value === '' ? null : Number(String(value).replace(',', '.'));
        const form = e.currentTarget;
        // La cagnotte est bouclée grâce à moi : confettis !
        const completes = wish.target && wish.collected - (wish.my_amount || 0) + (amount || 0) >= wish.target;
        run(() => api.gift(wish.id, 'amount', amount), () => completes && burst(form));
      }}
    >
      <label htmlFor={`amount-${wish.id}`}>Ma part</label>
      <input
        id={`amount-${wish.id}`}
        type="text"
        inputMode="decimal"
        pattern="[0-9]+([.,][0-9]{1,2})?"
        placeholder={suggested ? String(Math.round(suggested)) : '50'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <span aria-hidden="true">€</span>
      {changed && <button className="button button-small button-go" disabled={busy}>OK</button>}
    </form>
  );
}

// Les boutons pour offrir le cadeau de quelqu'un d'autre, selon où il en est.
function GiftActions({ wish, busy, run }) {
  const act = (action, celebrate) => (e) => {
    if (celebrate) burst(e.currentTarget);
    run(() => api.gift(wish.id, action));
  };
  const boughtButton = (
    <button
      className={`button button-small ${wish.bought ? 'button-bought' : 'button-buy'}`}
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
        <button className="button button-small button-leave" disabled={busy} onClick={act('leave')}>Je me retire</button>
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

// Petit halo vert sur la carte pour confirmer qu'une action a marché.
function flash(element) {
  if (!element) return;
  element.classList.remove('wish-flash');
  void element.offsetWidth; // relance l'animation même si elle vient de jouer
  element.classList.add('wish-flash');
}

// L'envie supprimée glisse et se replie avant de disparaître.
function collapse(element) {
  return new Promise((resolve) => {
    const mm = gsap.matchMedia();
    let animated = false;
    mm.add(MOTION_OK, () => {
      animated = true;
      gsap.timeline({ onComplete: resolve })
        .to(element, { x: -24, opacity: 0, duration: 0.25, ease: 'power2.in' })
        .to(element, { height: 0, paddingTop: 0, paddingBottom: 0, marginTop: -8, duration: 0.25, ease: 'power2.inOut' });
    });
    if (!animated) resolve();
  });
}

function WishRow({ wish, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const row = useRef(null);

  async function run(action, onSuccess) {
    setBusy(true);
    setError('');
    try {
      await action();
      flash(row.current);
      onSuccess?.();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer « ${wish.title} » ?`)) return;
    setBusy(true);
    try {
      await api.deleteWish(wish.id);
      await collapse(row.current);
      onChanged();
    } catch (err) {
      setError(err.message);
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
    <li ref={row} className={`wish${taken ? ' wish-taken' : ''}${wish.favorite ? ' wish-favorite' : ''}`}>
      {!!wish.has_photo && (
        <a className="wish-photo" href={api.photoUrl(wish.id)} target="_blank" rel="noopener noreferrer" aria-label={`Voir la photo de « ${wish.title} » en grand`}>
          <img src={api.photoUrl(wish.id)} alt="" loading="lazy" />
        </a>
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
            {wish.group_gift && <span className="badge badge-group"><Icon name="family" size={13} />À plusieurs</span>}
            {taken && <span className="badge badge-taken"><Icon name="check" size={13} />Réservé par {wish.reserved_by_name}</span>}
            {wish.bought && <span className="badge badge-bought"><Icon name="bag" size={13} />Acheté</span>}
          </p>
        )}
        {error && <p className="error small" role="alert">{error}</p>}
      </div>
      {wish.group_gift && (
        <GroupProgress wish={wish}>
          {wish.participating && <MyAmount key={wish.my_amount} wish={wish} busy={busy} run={run} />}
        </GroupProgress>
      )}
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
            onClick={remove}
          >
            <Icon name="trash" size={18} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function WishList({ wishes, emptyText, onChanged }) {
  // Les envies arrivent en cascade, et de nouveau quand on en ajoute une.
  const list = useStagger(wishes.length);
  if (!wishes.length) return <p className="empty-inline">{emptyText}</p>;
  return (
    <ul className="wish-list" ref={list}>
      {wishes.map((w) => <WishRow key={w.id} wish={w} onChanged={onChanged} />)}
    </ul>
  );
}
