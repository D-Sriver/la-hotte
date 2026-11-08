import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import PageHead from './PageHead.jsx';
import { frameStyle, parseFrame } from '../photoFrame.js';
import { usePageIntro } from '../motion.js';
import { usePageTitle } from '../usePageTitle.js';
import { OCCASION_LABEL } from './WishList.jsx';

const euros = (n) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Prix relu chaque matin sur la page du produit (cadeaux réservés pas encore achetés).
function PriceWatch({ watch }) {
  if (!watch.tracked) return <p className="price-watch muted small">Prix non suivi : la boutique ne le donne pas</p>;
  if (!watch.drop) return null;
  return (
    <p className="price-watch price-drop">
      <Icon name="tag" size={14} />
      Prix en baisse : <strong className="num">{euros(watch.last)}</strong> au lieu de {euros(watch.first)}
    </p>
  );
}

// Tout ce que je prévois d'offrir, regroupé par personne.
export default function GiftsPage({ familyId, onSwitchFamily }) {
  usePageTitle('Ce que j’offre');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => {
    api
      .reservations()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const scope = usePageIntro(data !== null || error !== '');

  async function act(id, action) {
    setBusy(id);
    try {
      await api.gift(id, action);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!data) return <Skeleton rows={4} />;

  const { gifts, given = [], total, year_total: yearTotal = total, unpriced } = data;
  const bought = gifts.filter((g) => g.bought).length;
  // Par personne : ce qui est prévu, puis ce qui a déjà été offert cette année, avec le total des deux.
  const byPerson = Object.values(
    [...gifts, ...given].reduce((groups, g) => {
      const person = (groups[g.owner_id] ||= {
        id: g.owner_id,
        name: g.owner_name,
        families: g.families || [],
        gifts: [],
        total: 0,
      });
      person.gifts.push(g);
      person.total += g.my_share || 0;
      return groups;
    }, {}),
  );
  const year = new Date().getFullYear();

  return (
    <div className="bento-page gifts-page" ref={scope}>
      <a href="#/" className="back">
        <Icon name="back" size={18} />
        Famille
      </a>
      <PageHead
        title="Ce que j’offre"
        tone="green"
        stats={[
          `${gifts.length} cadeau${gifts.length > 1 ? 'x' : ''}`,
          `${euros(total)} de budget${unpriced ? ` (+ ${unpriced} sans prix)` : ''}`,
          `${bought} acheté${bought > 1 ? 's' : ''}`,
          ...(given.length ? [`${euros(yearTotal)} en ${year}, déjà offerts compris`] : []),
        ]}
      />
      {gifts.some((g) => g.group_gift) && (
        <p className="page-note">
          <Icon name="family" size={15} />À plusieurs, seule ta part compte dans le budget.
        </p>
      )}

      {byPerson.length === 0 && (
        <section className="tile section">
          <p className="empty-inline">Va voir les listes de la famille et réserve ce que tu veux offrir.</p>
          <a className="button" href="#/">
            Voir la famille
          </a>
        </section>
      )}

      {byPerson.map((person) => (
        <section key={person.id} className="tile section">
          <div className="section-head">
            <h2 className="section-title">
              <a
                href={`#/p/${person.id}`}
                onClick={(e) => {
                  // Sa page s'ouvre dans une famille qu'on partage : on y passe d'abord si besoin.
                  if (!person.families.length || person.families.includes(familyId)) return;
                  e.preventDefault();
                  onSwitchFamily(person.families[0], `#/p/${person.id}`);
                }}
              >
                {person.name}
              </a>
              <span className="count">{person.gifts.length}</span>
            </h2>
            {person.total > 0 && (
              <span className="price person-total">{euros(Math.round(person.total * 100) / 100)}</span>
            )}
          </div>
          <ul className="wish-list">
            {person.gifts.map((g) => (
              <li key={g.id} className={`wish${g.bought || g.received ? ' wish-bought' : ''}`}>
                {g.cover && (
                  <span className={`wish-photo wish-photo-box${g.cover.frame ? ' is-framed' : ''}`}>
                    <img
                      src={api.photoUrl(g.id, g.cover.id)}
                      alt=""
                      loading="lazy"
                      style={frameStyle(parseFrame(g.cover.frame))}
                    />
                  </span>
                )}
                <div className="wish-main">
                  <p className="wish-title">
                    {g.url ? (
                      <a href={g.url} target="_blank" rel="noopener noreferrer">
                        {g.title}
                      </a>
                    ) : (
                      g.title
                    )}
                  </p>
                  {g.removed && (
                    <p className="badges">
                      <span className="badge badge-warn">Retirée de sa liste : à toi de voir</span>
                    </p>
                  )}
                  <p className="wish-meta">
                    {g.my_share !== null && <span className="price">{euros(g.my_share)}</span>}
                    {g.group_gift
                      ? g.my_amount_set
                        ? `ma part, à ${g.participant_count}`
                        : `part égale à ${g.participant_count}, montant à préciser`
                      : g.price
                        ? ''
                        : 'prix non indiqué'}
                    {!g.received && <span className="occasion"> · {OCCASION_LABEL[g.occasion]}</span>}
                  </p>
                  {g.price_watch && <PriceWatch watch={g.price_watch} />}
                  {g.thanked && (
                    <p className="price-watch thanked">
                      <Icon name="heart" size={14} />
                      {person.name} t’a dit merci
                    </p>
                  )}
                </div>
                {g.received ? (
                  <span className="badge badge-taken">
                    <Icon name="gift" size={14} />
                    Offert
                  </span>
                ) : !g.i_buy ? (
                  <span className={`badge ${g.bought ? 'badge-bought' : 'badge-group'}`}>
                    <Icon name={g.bought ? 'check' : 'family'} size={14} />
                    {g.bought ? 'Acheté' : 'L’organisateur achète'}
                  </span>
                ) : (
                  <div className="wish-actions">
                    <button
                      className={`button button-small button-quiet${g.bought ? ' button-bought' : ''}`}
                      disabled={busy === g.id}
                      aria-pressed={g.bought}
                      onClick={() => act(g.id, 'bought')}
                    >
                      <Icon name={g.bought ? 'check' : 'bag'} size={16} />
                      {g.bought ? 'Acheté' : 'Marquer acheté'}
                    </button>
                    {/* Une fois donné : il rejoint les archives (et le récap de Noël de la personne). */}
                    {g.bought && (
                      <button
                        className="button button-small button-quiet"
                        disabled={busy === g.id}
                        onClick={() => act(g.id, 'given')}
                      >
                        <Icon name="gift" size={16} />
                        Offert
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
