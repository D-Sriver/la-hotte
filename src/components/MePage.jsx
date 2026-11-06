import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import { profileCompletion } from '../profile.js';
import CountUp from './CountUp.jsx';
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
    <div className="bento-page bento-me" ref={scope}>
      <header className="tile tile-me-hero" data-zoom-target>
        <p className="hero-hello">Ma liste</p>
        <p className="hero-days"><CountUp value={count} />{count === 1 ? 'envie' : 'envies'}</p>
        <p className="hero-sub">Fais rêver la famille. Tu ne verras jamais ce qu’ils réservent : la surprise reste entière.</p>
      </header>

      <a href="#/profil" className="tile tile-mini tone-green">
        <span className="mini-num num">{done}/{total}</span>
        <span className="mini-label">{done === total ? 'Profil complet' : 'Complète ton profil'}</span>
        <span className="tile-arrow"><Icon name="chevron" size={18} /></span>
      </a>

      <div className="tile tile-mini tone-pink">
        <span className="mini-icon"><Icon name="link" size={22} /></span>
        <span className="mini-label">Colle le lien du produit : la famille tombera sur le bon modèle.</span>
      </div>

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
