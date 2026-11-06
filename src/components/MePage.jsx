import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import { profileCompletion } from '../profile.js';
import PageHead from './PageHead.jsx';
import { usePageIntro } from '../motion.js';

export default function MePage({ me }) {
  const [wishes, setWishes] = useState(null);
  const [archived, setArchived] = useState([]);
  const load = useCallback(() => {
    api.me().then((d) => {
      setWishes(d.wishes);
      setArchived(d.archived || []);
    });
  }, []);
  useEffect(load, [load]);

  const { done, total } = profileCompletion(me);
  const count = wishes?.length;
  const scope = usePageIntro(wishes !== null);

  return (
    <div className="bento-page" ref={scope}>
      <PageHead
        title="Ma liste"
        stats={[count === undefined ? null : `${count} envie${count > 1 ? 's' : ''}`]}
        subtitle="La famille réserve en secret : la surprise reste entière."
      >
        {done < total && (
          <a href="#/profil" className="page-head-chip">
            <span className="num">{done}/{total}</span> Compléter mon profil<Icon name="chevron" size={14} />
          </a>
        )}
      </PageHead>

      <section className="tile section">
        <div className="section-head">
          <h2 className="section-title">Mes envies{wishes ? <span className="count">{wishes.length}</span> : null}</h2>
        </div>
        {wishes
          ? <WishList wishes={wishes} emptyText="Liste vide. Le Père Noël va improviser… tu es sûr ?" onChanged={load} />
          : <Skeleton rows={2} />}
        <AddWishForm ownerId={me.id} onAdded={load} />
      </section>

      {archived.length > 0 && (
        <details className="tile section archives">
          <summary className="section-title">
            Cadeaux reçus<span className="count">{archived.length}</span>
          </summary>
          <p className="muted small">Ce que tu as marqué « Reçu ». La famille ne les voit plus dans ta liste.</p>
          <ul className="archive-list">
            {archived.map((w) => (
              <li key={w.id} className="archive-item">
                <span className="archive-title">{w.title}</span>
                <button className="button button-small button-quiet" onClick={() => api.setReceived(w.id, false).then(load)}>
                  Remettre dans ma liste
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <IdeasPanel person={{ ...me, is_me: true }} onAdded={load} />
    </div>
  );
}
