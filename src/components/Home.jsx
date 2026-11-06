import { useEffect, useState } from 'react';
import { copyText, shareFamily } from '../share.js';
import { inviteLink } from '../invite.js';
import { api } from '../api.js';
import {
  birthdayLine,
  christmasLine,
  daysUntilBirthday,
  deName,
  daysUntilChristmas,
  greetingsFor,
  nextOccasion,
  toneOf,
} from '../fun.js';
import Gift3D from './Gift3D.jsx';
import Icon from './Icon.jsx';
import CountUp from './CountUp.jsx';
import { zoomInto } from '../zoom.js';
import { usePageIntro, useStagger } from '../motion.js';

const birthdayLabel = (days) =>
  days === 0 ? 'Anniv. aujourd’hui !' : days === 1 ? 'Anniv. demain' : `Anniv. dans ${days} j`;

const countLabel = (n) => (n === 0 ? 'Liste vide' : n === 1 ? '1 envie' : `${n} envies`);

const euros = (n) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Dernière carte de la grille : inviter quelqu'un, là où apparaissent les personnes.
function InviteCard({ family, alone }) {
  const [done, setDone] = useState('');
  const confirm = (message) => {
    setDone(message);
    setTimeout(() => setDone(''), 2000);
  };

  return (
    <div className={`tile invite-card${alone ? ' invite-card-alone' : ''}`}>
      <p className="invite-title">
        <Icon name="plus" size={18} />
        {alone ? 'Invite ta famille' : 'Inviter'}
      </p>
      <p className="invite-code num" aria-label={`Code de « ${family.name} » : ${family.code}`}>
        {family.code}
      </p>
      {alone && (
        <p className="muted small">
          Envoie le lien : chacun se connecte avec son email et rejoint «&nbsp;{family.name}&nbsp;». Le code sert à le
          dicter.
        </p>
      )}
      <div className="invite-actions">
        <button
          className="icon-button"
          aria-label="Copier le lien d’invitation"
          onClick={() =>
            copyText(inviteLink(family.code))
              .then(() => confirm('Lien copié'))
              .catch(() => confirm('Copie impossible'))
          }
        >
          <Icon name={done === 'Lien copié' ? 'check' : 'copy'} size={18} />
        </button>
        <button
          className="button button-small button-go"
          onClick={() => shareFamily(family).then((r) => r === 'copied' && confirm('Invitation copiée'))}
        >
          <Icon name="share" size={16} />
          Partager
        </button>
      </div>
      <span className="invite-done" role="status">
        {done}
      </span>
    </div>
  );
}

// « Ce que j'offre » en résumé : combien, quel budget, et les prochains à acheter.
function GivingSummary({ gifts, suggestion }) {
  const list = useStagger(gifts?.length || 0);
  if (!gifts) return <section className="tile giving skeleton-tile" />;
  const total = gifts.reduce((sum, g) => sum + (g.my_share || 0), 0);
  const bought = gifts.filter((g) => g.bought).length;
  const next = [...gifts].sort((a, b) => a.bought - b.bought).slice(0, 3);

  return (
    <section className="tile giving">
      <div className="section-head">
        <h2 className="section-title">
          Ce que j’offre<span className="count">{gifts.length}</span>
        </h2>
        {gifts.length > 0 && (
          <a className="link-more" href="#/cadeaux">
            Tout voir
            <Icon name="chevron" size={16} />
          </a>
        )}
      </div>
      {gifts.length === 0 ? (
        <div className="giving-empty">
          <p className="muted small">
            Rien de réservé pour l’instant. Ouvre la liste de quelqu’un et touche « Je réserve ».
          </p>
          {/* L'occasion la plus proche : on propose d'aller voir sa liste tout de suite. */}
          {suggestion && (
            <a className="button button-accent giving-cta" href={`#/p/${suggestion.id}`}>
              <Icon name="gift" size={18} />
              Voir la liste {deName(suggestion.name)}
            </a>
          )}
        </div>
      ) : (
        <>
          <p className="giving-stats">
            <span>
              <strong className="num">{euros(total)}</strong> de budget
            </span>
            <span>
              <strong className="num">
                {bought}/{gifts.length}
              </strong>{' '}
              acheté{bought > 1 ? 's' : ''}
            </span>
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
  const [luck] = useState(() => Math.random());
  const scope = usePageIntro(people !== null || error !== '');

  const [myWishes, setMyWishes] = useState(null);

  useEffect(() => {
    api
      .people()
      .then((d) => {
        setPeople(d.people.filter((p) => !p.is_me));
        setMyWishes(d.people.find((p) => p.is_me)?.wish_count ?? null);
      })
      .catch((e) => setError(e.message));
    api
      .reservations()
      .then((d) => setGifts(d.gifts))
      .catch(() => setGifts([]));
  }, []);

  const alone = people?.length === 0;
  // Le prochain événement de la famille : un anniversaire (le mien compris) ou Noël, le plus proche.
  // On attend d'avoir la famille pour ne pas afficher Noël puis changer d'avis.
  const occasion =
    people || error ? nextOccasion([...(people || []), { name: me.name, birthday: me.birthday, isMe: true }]) : null;
  const christmasDays = daysUntilChristmas();
  const suggestion =
    occasion?.kind === 'birthday' && !occasion.isMe
      ? people?.find((p) => p.name === occasion.name)
      : people?.find((p) => p.wish_count > 0) || people?.[0];
  const greetings = greetingsFor(occasion || { kind: 'birthday' });
  const greeting = greetings[Math.floor(luck * greetings.length)];
  // Les cartes des personnes arrivent l'une après l'autre (portée limitée à la grille, nettoyée par useGSAP).
  const grid = useStagger(people?.length || 0);

  return (
    <div className="bento home" ref={scope}>
      <section className="tile tile-hero">
        <div className="hero-text">
          <p className="hero-hello">
            {greeting} {me.name}
          </p>
          {occasion && (
            <>
              <p className="hero-days">
                <CountUp value={occasion.days} /> jour{occasion.days > 1 ? 's' : ''}
              </p>
              <p className="hero-sub">
                {occasion.kind === 'christmas' ? (
                  <>avant Noël. {christmasLine(occasion.days)}</>
                ) : (
                  <>
                    avant {occasion.isMe ? 'ton anniversaire' : `l’anniversaire ${deName(occasion.name)}`}.{' '}
                    {birthdayLine(occasion.days, occasion.isMe)}
                  </>
                )}
              </p>
              {/* Un anniversaire passe en premier : Noël reste rappelé, en plus petit. */}
              {occasion.kind === 'birthday' && (
                <p className="hero-next">
                  Puis Noël dans {christmasDays} jour{christmasDays > 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>
        <Gift3D />
      </section>

      <h1 className="bento-title">Qui on gâte&nbsp;?</h1>

      {error && (
        <p className="error tile tile-wide" role="alert">
          {error}
        </p>
      )}
      {!people && !error && <div className="tile tile-wide skeleton-tile" />}

      {people && (
        <div className="people-grid tile-wide" ref={grid}>
          {people.map((p) => {
            const birthday = daysUntilBirthday(p.birthday);
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
                <span className="person-initial" aria-hidden="true">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="person-name">{p.name}</span>
                <span className="person-meta">{countLabel(p.wish_count)}</span>
                {birthday !== null && birthday <= 30 && (
                  <span className="person-birthday">
                    <Icon name="cake" size={13} />
                    {birthdayLabel(birthday)}
                  </span>
                )}
              </a>
            );
          })}
          <InviteCard family={me.family} alone={alone} />
        </div>
      )}

      {/* Liste vide : la famille n'a rien pour se guider, on le rappelle tout de suite. */}
      {myWishes === 0 && (
        <section className="tile tile-wide section my-list-nudge">
          <h2 className="section-title">Et toi, qu’est-ce qui te ferait plaisir&nbsp;?</h2>
          <p className="muted small">
            Ta liste est vide : ajoute une ou deux envies pour aider la famille. Personne ne saura ce qu’on t’offre.
          </p>
          <a className="button button-accent" href="#/moi">
            <Icon name="plus" size={18} />
            Remplir ma liste
          </a>
        </section>
      )}

      <GivingSummary gifts={gifts} suggestion={suggestion} />
    </div>
  );
}
