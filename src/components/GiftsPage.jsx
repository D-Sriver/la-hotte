import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import CountUp from './CountUp.jsx';
import { usePageIntro } from '../motion.js';

const euros = (n) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Tout ce que je prévois d'offrir, regroupé par personne.
export default function GiftsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => {
    api.reservations().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const scope = usePageIntro(data !== null || error !== '');

  async function toggleBought(id) {
    setBusy(id);
    try {
      await api.gift(id, 'bought');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <Skeleton rows={4} />;

  const { gifts, total, unpriced } = data;
  const bought = gifts.filter((g) => g.bought).length;
  const byPerson = Object.values(gifts.reduce((groups, g) => {
    (groups[g.owner_id] ||= { id: g.owner_id, name: g.owner_name, gifts: [] }).gifts.push(g);
    return groups;
  }, {}));

  return (
    <div className="bento-page bento-me" ref={scope}>
      <header className="tile tile-me-hero">
        <p className="hero-hello">À offrir</p>
        <p className="hero-days"><CountUp value={gifts.length} />{gifts.length === 1 ? 'cadeau' : 'cadeaux'}</p>
        <p className="hero-sub">
          {gifts.length ? `${bought} acheté${bought > 1 ? 's' : ''} sur ${gifts.length}.` : 'Rien de réservé pour l’instant.'}
        </p>
      </header>

      <div className="tile tile-mini tone-green">
        <span className="mini-num num">{euros(total)}</span>
        <span className="mini-label">
          Mon budget{unpriced ? `, sans ${unpriced} cadeau${unpriced > 1 ? 'x' : ''} sans prix` : ''}
        </span>
      </div>

      <div className="tile tile-mini tone-pink">
        <span className="mini-icon"><Icon name="family" size={22} /></span>
        <span className="mini-label">Cadeau à plusieurs : seule ma part compte dans le budget (le montant que j’ai indiqué, sinon une part égale).</span>
      </div>

      {byPerson.length === 0 && (
        <section className="tile section">
          <p className="empty-inline">Va voir les listes de la famille et réserve ce que tu veux offrir.</p>
          <a className="button" href="#/">Voir la famille</a>
        </section>
      )}

      {byPerson.map((person) => (
        <section key={person.id} className="tile section">
          <div className="section-head">
            <h2 className="section-title"><a href={`#/p/${person.id}`}>{person.name}</a><span className="count">{person.gifts.length}</span></h2>
          </div>
          <ul className="wish-list">
            {person.gifts.map((g) => (
              <li key={g.id} className={`wish${g.bought ? ' wish-bought' : ''}`}>
                {!!g.has_photo && <span className="wish-photo"><img src={api.photoUrl(g.id)} alt="" loading="lazy" /></span>}
                <div className="wish-main">
                  <p className="wish-title">
                    {g.url ? <a href={g.url} target="_blank" rel="noopener noreferrer">{g.title}</a> : g.title}
                  </p>
                  <p className="wish-meta">
                    {g.my_share !== null && <span className="price">{euros(g.my_share)}</span>}
                    {g.group_gift
                      ? g.my_amount_set ? `ma part, à ${g.participant_count}` : `part égale à ${g.participant_count}, montant à préciser`
                      : g.price ? '' : 'prix non indiqué'}
                  </p>
                </div>
                <div className="wish-actions">
                  <button
                    className={`button button-small button-quiet${g.bought ? ' button-bought' : ''}`}
                    disabled={busy === g.id}
                    aria-pressed={g.bought}
                    onClick={() => toggleBought(g.id)}
                  >
                    <Icon name={g.bought ? 'check' : 'bag'} size={16} />{g.bought ? 'Acheté' : 'Marquer acheté'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
