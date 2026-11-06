import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { christmasLine, daysUntilChristmas, GREETINGS, pick, toneOf } from '../fun.js';
import Gift3D from './Gift3D.jsx';
import Icon from './Icon.jsx';
import CountUp from './CountUp.jsx';
import { zoomInto } from '../zoom.js';
import { usePageIntro } from '../motion.js';

const countLabel = (n) => (n === 0 ? 'Liste vide' : n === 1 ? '1 idée' : `${n} idées`);

export default function Home({ me }) {
  const [people, setPeople] = useState(null);
  const [myCount, setMyCount] = useState(null);
  const [error, setError] = useState('');
  const [greeting] = useState(() => pick(GREETINGS));
  const days = daysUntilChristmas();
  const scope = usePageIntro(people !== null || error !== '');

  useEffect(() => {
    api.people()
      .then((d) => {
        setPeople(d.people.filter((p) => !p.is_me));
        setMyCount(d.people.find((p) => p.is_me)?.wish_count ?? 0);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bento" ref={scope}>
      <section className="tile tile-hero">
        <div className="hero-text">
          <p className="hero-hello">{greeting} {me.name}</p>
          <p className="hero-days"><CountUp value={days} /> jours</p>
          <p className="hero-sub">avant Noël. {christmasLine(days)}</p>
        </div>
        <Gift3D />
      </section>

      <a href="#/moi" className="tile tile-stat tile-cream">
        <CountUp value={myCount} className="stat-num num" />
        <span className="stat-label">{myCount === 1 ? 'envie sur ta liste' : 'envies sur ta liste'}</span>
        <span className="tile-arrow"><Icon name="chevron" size={18} /></span>
      </a>

      <div className="tile tile-stat tile-green">
        <CountUp value={people?.length} className="stat-num num" />
        <span className="stat-label">{people?.length === 1 ? 'personne à gâter' : 'personnes à gâter'}</span>
      </div>

      <h1 className="bento-title">Qui on gâte&nbsp;?</h1>

      {error && <p className="error tile tile-wide" role="alert">{error}</p>}
      {!people && !error && <div className="tile tile-wide skeleton-tile" />}

      {people && people.length === 0 && (
        <div className="tile tile-wide tile-cream empty">
          <p className="empty-title">Personne d’autre pour l’instant</p>
          <p className="muted">Envoie le lien de La Hotte à la famille : chacun se connecte avec son email et crée son profil.</p>
        </div>
      )}

      {people?.map((p, i) => (
        <a
          key={p.id}
          href={`#/p/${p.id}`}
          data-person-tile={p.id}
          onClick={(e) => {
            e.preventDefault();
            zoomInto(e.currentTarget, `#/p/${p.id}`);
          }}
          className={`tile tile-person tone-${toneOf(p.id)}${i === 0 ? ' tile-big' : ''}`}
        >
          <span className="person-initial">{p.name.charAt(0).toUpperCase()}</span>
          <span className="person-name">{p.name}</span>
          <span className="person-meta">{countLabel(p.wish_count)}</span>
          <span className="tile-arrow"><Icon name="chevron" size={18} /></span>
        </a>
      ))}
    </div>
  );
}
