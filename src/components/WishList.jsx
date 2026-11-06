import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import WishForm from './WishForm.jsx';
import { burst, toneOf } from '../fun.js';
import PhotoCarousel from './PhotoCarousel.jsx';
import { gsap, MOTION_OK, useStagger } from '../motion.js';

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const euros = (n) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Où en est la cagnotte d'un cadeau à plusieurs : qui met combien, et la barre vers le prix.
function GroupProgress({ wish, children }) {
  const ratio = wish.target ? Math.min(1, wish.collected / wish.target) : 0;
  const missing = wish.target ? Math.max(0, wish.target - wish.collected) : null;
  return (
    <div className={`group-progress${wish.target && wish.collected >= wish.target ? ' group-done' : ''}`}>
      {wish.target ? (
        <>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={wish.target}
            aria-valuenow={wish.collected}
            aria-label={`${euros(wish.collected)} réunis sur ${euros(wish.target)}`}
          >
            <span style={{ transform: `scaleX(${ratio})` }} />
          </div>
          <p className="progress-text num">
            <strong>{euros(wish.collected)}</strong> sur {euros(wish.target)}
            {missing > 0 ? `, il manque ${euros(missing)}` : ', c’est bouclé 🎉'}
          </p>
        </>
      ) : (
        <p className="progress-text num">
          <strong>{euros(wish.collected)}</strong> réunis (pas de prix indiqué)
        </p>
      )}
      <p className="group-organizer">
        <Icon name="bag" size={14} />
        {wish.reserved_by_me
          ? 'Tu organises : c’est toi qui achètes, les autres te donnent leur part.'
          : `${capitalize(wish.reserved_by_name)} organise et achète : tu lui donnes ta part.`}
      </p>
      <ul className="chips" aria-label="Participants">
        {wish.participants.map((p) => (
          <li key={p.id} className="chip">
            <span className={`chip-dot tone-${toneOf(p.id)}`} aria-hidden="true">
              {p.name.charAt(0).toUpperCase()}
            </span>
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
  // Suggestion : une part égale entre les participants, sans dépasser ce qui manque. Seul, on ne suggère rien.
  const others = wish.collected - (wish.my_amount || 0);
  const suggested =
    wish.target && wish.participants.length > 1
      ? Math.min(Math.max(0, wish.target - others), wish.target / wish.participants.length)
      : null;
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
        run(
          () => api.gift(wish.id, 'amount', amount),
          () => completes && burst(form),
        );
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
      {changed && (
        <button className="button button-small button-go" disabled={busy}>
          OK
        </button>
      )}
    </form>
  );
}

// Les boutons pour offrir le cadeau de quelqu'un d'autre, selon où il en est.
function GiftActions({ wish, busy, run }) {
  // Lancer une cagnotte engage (on achète, la famille est prévenue) : on le dit avant, dans la page.
  const [confirmingGroup, setConfirmingGroup] = useState(false);
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
      <Icon name={wish.bought ? 'check' : 'bag'} size={16} />
      {wish.bought ? 'Acheté' : 'Marquer acheté'}
    </button>
  );

  if (!wish.reserved && confirmingGroup) {
    return (
      <div className="confirm-group" role="group" aria-label="Lancer une cagnotte">
        <p>
          <strong>Offrir à plusieurs ?</strong> C’est toi qui achètes le cadeau, les autres te donnent leur part. La
          famille sera prévenue.
        </p>
        <button className="button button-small button-go" disabled={busy} onClick={act('group', true)}>
          Oui, lancer la cagnotte
        </button>
        <button className="button button-small button-quiet" disabled={busy} onClick={() => setConfirmingGroup(false)}>
          Non, retour
        </button>
      </div>
    );
  }
  if (!wish.reserved) {
    return (
      <>
        <button className="button button-small button-go" disabled={busy} onClick={act('reserve', true)}>
          Je réserve
        </button>
        <button
          className="button button-small button-quiet button-alt"
          disabled={busy}
          onClick={() => setConfirmingGroup(true)}
        >
          <Icon name="family" size={16} />
          Offrir à plusieurs
        </button>
      </>
    );
  }
  // Une fois acheté : « Offert » le fait passer dans les archives.
  const givenButton = wish.bought && (
    <button
      className="button button-small button-go"
      disabled={busy}
      onClick={(e) => {
        burst(e.currentTarget);
        run(() => api.gift(wish.id, 'given'), null, true);
      }}
    >
      <Icon name="gift" size={16} />
      Offert
    </button>
  );

  if (wish.group_gift) {
    // Seul l'organisateur achète : lui seul coche « acheté » puis « offert ».
    if (wish.removed && !wish.participating) return null;
    return wish.participating ? (
      <>
        {wish.reserved_by_me && givenButton}
        {wish.reserved_by_me && boughtButton}
        <button className="button button-small button-leave" disabled={busy} onClick={act('leave')}>
          Je me retire
        </button>
      </>
    ) : (
      <button className="button button-small button-go" disabled={busy} onClick={act('join', true)}>
        <Icon name="plus" size={16} />
        Je participe
      </button>
    );
  }
  if (wish.reserved_by_me) {
    return (
      <>
        {givenButton}
        {boughtButton}
        <button className="button button-small button-leave" disabled={busy} onClick={act('reserve')}>
          Annuler
        </button>
      </>
    );
  }
  return null;
}

const timeOf = (iso) =>
  new Date(`${iso.replace(' ', 'T')}Z`).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

// Discussion secrète entre ceux qui offrent ce cadeau (jamais vue par la personne gâtée).
function WishChat({ wish, onCount }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);

  const load = () =>
    api
      .messages(wish.id)
      .then((d) => {
        setMessages(d.messages);
        onCount(d.messages.length);
        requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'nearest' }));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.sendMessage(wish.id, text);
      setText('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat">
      <p className="chat-note">
        <Icon name="lock" size={13} />
        Entre vous : la personne gâtée ne voit jamais cette discussion.
      </p>
      {messages === null && !error && <p className="muted small">Chargement…</p>}
      {messages?.length === 0 && (
        <p className="muted small">Pas encore de message. Qui s’en occupe ? Quelle taille ? Lancez-vous.</p>
      )}
      {messages?.length > 0 && (
        <ul className="chat-list">
          {messages.map((m) => (
            <li key={m.id} className={`chat-msg${m.mine ? ' chat-mine' : ''}`}>
              {!m.mine && <span className="chat-author">{m.name}</span>}
              <span className="chat-body">{m.body}</span>
              <span className="chat-meta">
                {timeOf(m.created_at)}
                {m.mine && (
                  <button
                    type="button"
                    className="chat-delete"
                    onClick={() => api.deleteMessage(wish.id, m.id).then(load)}
                    aria-label="Effacer ce message"
                  >
                    Effacer
                  </button>
                )}
              </span>
            </li>
          ))}
          <li ref={bottom} aria-hidden="true" />
        </ul>
      )}
      <form className="chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire aux autres…"
          maxLength={1000}
          aria-label="Message"
        />
        <button className="button button-small button-go" disabled={sending || !text.trim()}>
          Envoyer
        </button>
      </form>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Menu « ⋯ » pour les actions rares (modifier, reçu, supprimer) : moins de boutons à l'écran,
// et pas de suppression ou d'archivage d'un toucher maladroit.
function MoreMenu({ label, items, disabled }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const entries = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="more" ref={root}>
      <button
        className="button button-small button-quiet more-toggle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" size={18} />
        Gérer
      </button>
      {open && (
        <div className="more-menu" role="menu">
          {entries.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`more-item${item.danger ? ' more-item-danger' : ''}`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Petit halo vert sur la carte pour confirmer qu'une action a marché.
function flash(element) {
  if (!element) return;
  element.classList.remove('wish-flash');
  void element.offsetWidth; // relance l'animation même si elle vient de jouer
  element.classList.add('wish-flash');
}

// L'envie supprimée glisse et se replie avant de disparaître.
// Lancé depuis un clic : un simple test de préférence (un gsap.matchMedia créé ici ne serait jamais nettoyé).
function collapse(element) {
  if (!element || !window.matchMedia(MOTION_OK).matches) return Promise.resolve();
  return new Promise((resolve) => {
    gsap
      .timeline({ onComplete: resolve })
      .to(element, { x: -24, opacity: 0, duration: 0.25, ease: 'power2.in' })
      // La hauteur n'est animée qu'ici, une fois la carte invisible, pour refermer le trou.
      .to(element, { height: 0, paddingTop: 0, paddingBottom: 0, marginTop: -8, duration: 0.25, ease: 'power2.inOut' });
  });
}

function WishRow({ wish, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const row = useRef(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(wish.message_count || 0);

  // leaves : l'envie quitte la liste (reçue, offerte) : elle se replie avant de disparaître.
  async function run(action, onSuccess, leaves) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (leaves) await collapse(row.current);
      else flash(row.current);
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
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const canDelete = wish.mine || wish.can_delete;
  const host = wish.url && hostOf(wish.url);
  // Grisé seulement quand il n'y a plus rien à faire pour moi dessus.
  const taken = wish.reserved && !wish.reserved_by_me && !wish.group_gift;

  return (
    <li ref={row} className={`wish${taken ? ' wish-taken' : ''}${wish.favorite ? ' wish-favorite' : ''}`}>
      {wish.photos?.length > 0 && <PhotoCarousel wishId={wish.id} photos={wish.photos} title={wish.title} />}
      <div className="wish-main">
        <p className="wish-title">
          {wish.url ? (
            <a href={wish.url} target="_blank" rel="noopener noreferrer">
              {wish.title}
            </a>
          ) : (
            wish.title
          )}
        </p>
        <p className="wish-meta">
          {wish.price && <span className="price">{wish.price}</span>}
          {[host, wish.note].filter(Boolean).join(', ')}
        </p>
        {(wish.favorite || wish.secret || wish.reserved || wish.bought || wish.removed) && (
          <p className="badges">
            {wish.favorite && (
              <span className="badge badge-favorite">
                <Icon name="star" size={13} />
                Coup de cœur
              </span>
            )}
            {wish.secret && (
              <span className="badge badge-secret">
                <Icon name="lock" size={13} />
                Idée secrète de {wish.added_by_name}
              </span>
            )}
            {wish.group_gift && (
              <span className="badge badge-group">
                <Icon name="family" size={13} />
                Cagnotte
              </span>
            )}
            {taken && (
              <span className="badge badge-taken">
                <Icon name="check" size={13} />
                Réservé par {wish.reserved_by_name}
              </span>
            )}
            {wish.reserved_by_me && !wish.group_gift && (
              <span className="badge badge-taken">
                <Icon name="check" size={13} />
                C’est toi qui l’offres
              </span>
            )}
            {wish.removed && <span className="badge badge-warn">Retirée de sa liste : à toi de voir</span>}
            {!wish.removed && wish.edited_after_reservation && (
              <span className="badge badge-warn">Modifiée depuis la réservation</span>
            )}
            {wish.bought && (
              <span className="badge badge-bought">
                <Icon name="bag" size={13} />
                Acheté
              </span>
            )}
          </p>
        )}
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
      </div>
      {wish.group_gift && (
        <GroupProgress wish={wish}>
          {wish.participating && <MyAmount key={wish.my_amount} wish={wish} busy={busy} run={run} />}
        </GroupProgress>
      )}
      {chatOpen && <WishChat wish={wish} onCount={setMessageCount} />}
      <div className="wish-actions">
        {!wish.mine && <GiftActions wish={wish} busy={busy} run={run} />}
        {!wish.mine && (
          // Discussion entre ceux qui offrent : un vrai bouton avec un texte, pas une icône à deviner.
          <button
            className={`button button-small button-quiet chat-toggle${chatOpen ? ' chat-toggle-open' : ''}`}
            aria-expanded={chatOpen}
            title="Discussion secrète entre ceux qui offrent : la personne gâtée ne la voit jamais"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <Icon name="chat" size={16} />
            {chatOpen
              ? 'Fermer'
              : messageCount > 0
                ? `${messageCount} message${messageCount > 1 ? 's' : ''}`
                : 'Discuter en secret'}
            {!chatOpen && <Icon name="lock" size={13} />}
          </button>
        )}
        {(wish.can_edit || canDelete || wish.mine) && (
          <MoreMenu
            label={`Plus d’actions pour « ${wish.title} »`}
            disabled={busy}
            items={[
              wish.can_edit && { label: 'Modifier', icon: 'pencil', onSelect: () => setEditing(true) },
              wish.mine && {
                label: 'Reçu, merci !',
                icon: 'check',
                onSelect: () =>
                  run(
                    () => api.setReceived(wish.id, true),
                    () => burst(row.current),
                    true,
                  ),
              },
              canDelete && { label: 'Supprimer', icon: 'trash', danger: true, onSelect: remove },
            ]}
          />
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
      {wishes.map((w) => (
        <WishRow key={w.id} wish={w} onChanged={onChanged} />
      ))}
    </ul>
  );
}
