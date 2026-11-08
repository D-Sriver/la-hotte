import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';
import { usePageIntro } from '../motion.js';
import { daysUntilBirthday, toneOf } from '../fun.js';
import { zoomBackHome } from '../zoom.js';
import { usePageTitle } from '../usePageTitle.js';

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

  usePageTitle(data?.person?.name);
  const load = useCallback(() => {
    api
      .person(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  const scope = usePageIntro(data !== null);

  const back = (
    <a
      href="#/"
      className="back"
      onClick={(e) => {
        e.preventDefault();
        zoomBackHome();
      }}
    >
      <Icon name="back" size={18} />
      Famille
    </a>
  );

  if (error)
    return (
      <>
        {back}
        <p className="error" role="alert">
          {error}
        </p>
      </>
    );
  if (!data)
    return (
      <>
        {back}
        <Skeleton rows={4} />
      </>
    );

  const { person, wishes } = data;
  const filled = PROFILE_ROWS.filter(([key]) => person[key]);
  const free = wishes.filter((w) => !w.reserved).length;
  const birthdayIn = daysUntilBirthday(person.birthday);

  return (
    <div className="bento-page person-page" ref={scope}>
      {back}
      <header className={`tile tile-head profile-header tone-${toneOf(id)}`} data-zoom-target data-person={id}>
        <Avatar name={person.name} index={id} size="lg" />
        <div>
          <h1 className="title">{person.name}</h1>
          <p className="muted">
            {free === 0 ? 'Tout est déjà pris' : `${free} cadeau${free > 1 ? 'x' : ''} encore à prendre`}
          </p>
          {birthdayIn !== null && birthdayIn <= 60 && (
            <p className="head-birthday">
              <Icon name="cake" size={15} />
              {birthdayIn === 0
                ? 'Anniversaire aujourd’hui'
                : birthdayIn === 1
                  ? 'Anniversaire demain'
                  : `Anniversaire dans ${birthdayIn} jours`}
            </p>
          )}
        </div>
      </header>

      <section className="tile section person-list">
        <div className="section-head">
          <h2 className="section-title">
            Sa liste<span className="count">{wishes.length}</span>
          </h2>
        </div>
        {!person.is_me && (
          <p className="notice">
            <Icon name="lock" size={15} />
            {person.name} ne voit ni ce qui est réservé, ni par qui, ni les idées secrètes.
          </p>
        )}
        <WishList
          wishes={wishes}
          emptyText="Rien pour l’instant. Des idées t’attendent juste en dessous."
          onChanged={load}
        />
        <AddWishForm ownerId={person.id} forSomeoneElse onAdded={load} />
      </section>

      {/* Ses goûts et les idées, à droite de sa liste sur grand écran. */}
      <div className="person-side">
        <section className="tile section person-profile">
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
            <p className="muted">
              {person.name} n’a rien dit sur ses goûts. Mystère total… les idées seront plus vagues.
            </p>
          )}
        </section>

        <IdeasPanel person={person} onAdded={load} />
      </div>
    </div>
  );
}
