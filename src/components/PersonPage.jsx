import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';
import { usePageIntro } from '../motion.js';
import { toneOf } from '../fun.js';
import { zoomBackHome } from '../zoom.js';

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
  const scope = usePageIntro(data !== null);

  const back = (
    <a href="#/" className="back" onClick={(e) => { e.preventDefault(); zoomBackHome(); }}>
      <Icon name="back" size={18} />Famille
    </a>
  );

  if (error) return <>{back}<p className="error" role="alert">{error}</p></>;
  if (!data) return <>{back}<Skeleton rows={4} /></>;

  const { person, wishes } = data;
  const filled = PROFILE_ROWS.filter(([key]) => person[key]);
  const free = wishes.filter((w) => !w.reserved || w.reserved_by_me).length;

  return (
    <div className="bento-page" ref={scope}>
      {back}
      <header className={`tile tile-head profile-header tone-${toneOf(id)}`} data-zoom-target data-person={id}>
        <Avatar name={person.name} index={id} size="lg" />
        <div>
          <h1 className="title">{person.name}</h1>
          <p className="muted">{free} idée{free > 1 ? 's' : ''} encore libre{free > 1 ? 's' : ''}</p>
        </div>
      </header>

      <section className="tile section">
        <h2 className="section-title">Son mode d’emploi</h2>
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
          <p className="muted">{person.name} n’a rien dit sur ses goûts. Mystère total… les idées seront plus vagues.</p>
        )}
      </section>

      <section className="tile section">
        <div className="section-head">
          <h2 className="section-title">Sa liste<span className="count">{wishes.length}</span></h2>
        </div>
        <WishList wishes={wishes} emptyText="Rien pour l’instant. Les lutins peuvent t’aider juste en dessous" onChanged={load} />
        <AddWishForm ownerId={person.id} forSomeoneElse onAdded={load} />
      </section>

      <IdeasPanel person={person} onAdded={load} />
    </div>
  );
}
