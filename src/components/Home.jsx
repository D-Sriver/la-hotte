import { useEffect, useState } from 'react';
import { copyText, shareFamily } from '../share.js';
import { api } from '../api.js';
import { christmasLine, daysUntilChristmas, GREETINGS, pick, toneOf } from '../fun.js';
import Gift3D from './Gift3D.jsx';
import Icon from './Icon.jsx';
import CountUp from './CountUp.jsx';
import { zoomInto } from '../zoom.js';
import { usePageIntro, useStagger } from '../motion.js';

// Dans combien de jours tombe un anniversaire (« MM-JJ »).
function daysToBirthday(monthDay) {
  if (!monthDay) return null;
  const [month, day] = monthDay.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next - today) / 86_400_000);
}
const birthdayLabel = (days) => (days === 0 ? 'Anniv. aujourd’hui !' : days === 1 ? 'Anniv. demain' : `Anniv. dans ${days} j`);

const countLabel = (n) => (n === 0 ? 'Liste vide' : n === 1 ? '1 idée' : `${n} idées`);

const euros = (n) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Le code de la famille sur une ligne : à copier ou à partager pour inviter quelqu'un.
function FamilyCodeBar({ family, highlight }) {
  const [done, setDone] = useState('');
  const confirm = (message) => {
    setDone(message);
    setTimeout(() => setDone(''), 2000);
  };

  return (
    <section className={`tile tile-wide code-bar${highlight ? ' code-bar-highlight' : ''}`} aria-label="Inviter dans la famille">
      <div className="code-bar-text">
        <span className="muted small">{highlight ? 'Invite la famille avec ce code' : `Code de « ${family.name} »`}</span>
        <strong className="code-bar-code num">{family.code}</strong>
      </div>
      <div className="code-bar-actions">
        <button
          className="icon-button"
          aria-label="Copier le code"
          onClick={() => copyText(family.code).then(() => confirm('Code copié')).catch(() => confirm('Copie impossible'))}
        >
          <Icon name={done === 'Code copié' ? 'check' : 'copy'} size={18} />
        </button>
        <button
          className="button button-small button-go"
          onClick={() => shareFamily(family).then((r) => r === 'copied' && confirm('Invitation copiée'))}
        >
          <Icon name="share" size={16} />Inviter
        </button>
      </div>
      <span className="code-done" role="status">{done}</span>
    </section>
  );
}

// « Ce que j'offre » en résumé : combien, quel budget, et les prochains à acheter.
function GivingSummary({ gifts }) {
  const list = useStagger(gifts?.length || 0);
  if (!gifts) return <section className="tile giving skeleton-tile" />;
  const total = gifts.reduce((sum, g) => sum + (g.my_share || 0), 0);
  const bought = gifts.filter((g) => g.bought).length;
  const next = [...gifts].sort((a, b) => a.bought - b.bought).slice(0, 3);

  return (
    <section className="tile giving">
      <div className="section-head">
        <h2 className="section-title">Ce que j’offre<span className="count">{gifts.length}</span></h2>
        {gifts.length > 0 && <a className="link-more" href="#/cadeaux">Tout voir<Icon name="chevron" size={16} /></a>}
      </div>
      {gifts.length === 0 ? (
        <p className="muted small">Rien de réservé pour l’instant. Ouvre la liste de quelqu’un et touche « Je réserve ».</p>
      ) : (
        <>
          <p className="giving-stats">
            <span><strong className="num">{euros(total)}</strong> de budget</span>
            <span><strong className="num">{bought}/{gifts.length}</strong> acheté{bought > 1 ? 's' : ''}</span>
          </p>
          <ul className="giving-list" ref={list}>
            {next.map((g) => (
              <li key={g.id} className={g.bought ? 'is-bought' : ''}>
                <Icon name={g.bought ? 'check' : 'bag'} size={16} />
                <span className="giving-title">{g.title}</span>
                <span className="muted small">pour {g.owner_name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function Home({ me }) {
  const [people, setPeople] = useState(null);
  const [gifts, setGifts] = useState(null);
  const [error, setError] = useState('');
  const [greeting] = useState(() => pick(GREETINGS));
  const days = daysUntilChristmas();
  const scope = usePageIntro(people !== null || error !== '');

  useEffect(() => {
    api.people()
      .then((d) => setPeople(d.people.filter((p) => !p.is_me)))
      .catch((e) => setError(e.message));
    api.reservations().then((d) => setGifts(d.gifts)).catch(() => setGifts([]));
  }, []);

  const alone = people?.length === 0;
  // Les cartes des personnes arrivent l'une après l'autre (portée limitée à la grille, nettoyée par useGSAP).
  const grid = useStagger(people?.length || 0);

  return (
    <div className="bento home" ref={scope}>
      <section className="tile tile-hero">
        <div className="hero-text">
          <p className="hero-hello">{greeting} {me.name}</p>
          <p className="hero-days"><CountUp value={days} /> jours</p>
          <p className="hero-sub">avant Noël. {christmasLine(days)}</p>
        </div>
        <Gift3D />
      </section>

      <h1 className="bento-title">Qui on gâte&nbsp;?</h1>

      {error && <p className="error tile tile-wide" role="alert">{error}</p>}
      {!people && !error && <div className="tile tile-wide skeleton-tile" />}

      {alone && (
        <div className="tile tile-wide tile-cream empty">
          <p className="empty-title">Personne d’autre pour l’instant</p>
          <p className="muted">Envoie le code ci-dessous à la famille : chacun se connecte avec son email et rejoint « {me.family.name} ».</p>
        </div>
      )}

      {people?.length > 0 && (
        <div className="people-grid tile-wide" ref={grid}>
          {people.map((p) => {
            const birthday = daysToBirthday(p.birthday);
            return (
              <a
                key={p.id}
                href={`#/p/${p.id}`}
                data-person-tile={p.id}
                onClick={(e) => {
                  e.preventDefault();
                  zoomInto(e.currentTarget, `#/p/${p.id}`);
                }}
                className={`tile tile-person tone-${toneOf(p.id)}`}
              >
                <span className="person-initial" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
                <span className="person-name">{p.name}</span>
                <span className="person-meta">{countLabel(p.wish_count)}</span>
                {birthday !== null && birthday <= 30 && (
                  <span className="person-birthday"><Icon name="cake" size={13} />{birthdayLabel(birthday)}</span>
                )}
              </a>
            );
          })}
        </div>
      )}

      <GivingSummary gifts={gifts} />

      <FamilyCodeBar family={me.family} highlight={alone} />
    </div>
  );
}
