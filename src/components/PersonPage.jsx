import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import GiftTag from './GiftTag.jsx';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';

const PROFILE_ROWS = [
  ['likes', 'Aime'],
  ['owns', 'A déjà'],
  ['dislikes', 'À éviter'],
  ['sizes', 'Tailles'],
  ['budget_hint', 'Budget'],
];

export default function PersonPage({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.person(id).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <p className="error" role="alert">{error} <a href="#/">Retour à la famille</a></p>;
  if (!data) return <p className="muted">Chargement…</p>;

  const { person, wishes } = data;
  const filled = PROFILE_ROWS.filter(([key]) => person[key]);
  const free = wishes.filter((w) => !w.reserved || w.reserved_by_me).length;

  return (
    <>
      <a href="#/" className="back">Toute la famille</a>
      <GiftTag name={person.name} detail={`${free} idée${free > 1 ? 's' : ''} encore libre${free > 1 ? 's' : ''}`} index={id} large />

      <section className="section">
        <h2 className="section-title">Ce qui lui plaît</h2>
        {filled.length ? (
          <dl className="profile">
            {filled.map(([key, label]) => (
              <div key={key} className="profile-row">
                <dt>{label}</dt>
                <dd>{person[key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">{person.name} n’a pas encore rempli son profil. Les idées seront plus vagues.</p>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Sa liste</h2>
        <WishList wishes={wishes} emptyText="Rien pour l’instant. Ajoute une idée ou lance une recherche." onChanged={load} />
        <AddWishForm ownerId={person.id} forSomeoneElse onAdded={load} />
      </section>

      <IdeasPanel person={person} onAdded={load} />
    </>
  );
}
