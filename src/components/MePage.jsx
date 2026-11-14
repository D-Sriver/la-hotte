import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';
import SharePanel from './SharePanel.jsx';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import { profileCompletion } from '../profile.js';
import PageHead from './PageHead.jsx';
import { usePageIntro } from '../motion.js';
import { usePageTitle } from '../usePageTitle.js';

const VIEWS = [
  { id: '1', label: '1 colonne', short: '1', wide: false },
  { id: '2', label: '2 colonnes', short: '2', wide: true },
  { id: '3', label: '3 colonnes', short: '3', wide: true },
  { id: 'compact', label: 'Liste compacte, sans images', short: 'Compact', wide: false },
];
const VIEW_KEY = 'la-hotte-vue-liste';

// Le choix d'affichage reste sur cet appareil ; sans stockage, on retombe sur une colonne.
function readView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((v) => v.id === saved) ? saved : '1';
  } catch {
    return '1';
  }
}

export default function MePage({ me }) {
  usePageTitle('Ma liste');
  const [wishes, setWishes] = useState(null);
  const [archived, setArchived] = useState([]);
  const [view, setView] = useState(readView);
  const chooseView = (id) => {
    setView(id);
    try {
      localStorage.setItem(VIEW_KEY, id);
    } catch {
      // Stockage indisponible : le choix vaut pour cette visite seulement.
    }
  };
  const [shareToken, setShareToken] = useState(undefined);
  const load = useCallback(() => {
    api.me().then((d) => {
      setWishes(d.wishes);
      setArchived(d.archived || []);
      setShareToken((current) => (current === undefined ? d.me.share_token : current));
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
            <span className="num">
              {done}/{total}
            </span>{' '}
            Compléter mon profil
            <Icon name="chevron" size={14} />
          </a>
        )}
      </PageHead>

      <section className="tile section">
        <div className="section-head">
          <h2 className="section-title">Mes envies{wishes ? <span className="count">{wishes.length}</span> : null}</h2>
          <div className="view-switch" role="group" aria-label="Affichage de la liste">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={v.wide ? 'view-wide' : undefined}
                aria-pressed={view === v.id}
                aria-label={v.label}
                title={v.label}
                onClick={() => chooseView(v.id)}
              >
                {v.short}
              </button>
            ))}
          </div>
        </div>
        {wishes ? (
          <WishList
            wishes={wishes}
            emptyText="Liste vide. Ajoute une envie, sinon ce sera la surprise totale."
            onChanged={load}
            view={view}
          />
        ) : (
          <Skeleton rows={2} />
        )}
        <AddWishForm ownerId={me.id} onAdded={load} />
      </section>

      <details className="tile section archives">
        <summary className="section-title">
          Cadeaux reçus{archived.length > 0 && <span className="count">{archived.length}</span>}
        </summary>
        <p className="muted small">
          Ce que tu as reçu : ajoute-le toi-même, ou marque une envie « Reçu ». La famille ne les voit pas dans ta
          liste.
        </p>
        <ul className="archive-list">
          {archived.map((w) => (
            <li key={w.id} className="archive-item">
              {w.photos?.length > 0 && (
                <img className="archive-photo" src={api.photoUrl(w.id, w.photos[0].id)} alt="" loading="lazy" />
              )}
              <span className="archive-text">
                <span className="archive-title">{w.title}</span>
                {w.price && <span className="muted small"> · {w.price}</span>}
                {w.note && <span className="muted small archive-note">{w.note}</span>}
                {w.url && (
                  <a className="small archive-link" href={w.url} target="_blank" rel="noopener noreferrer">
                    Voir le lien
                  </a>
                )}
              </span>
              <button
                className="button button-small button-quiet"
                onClick={() => api.setReceived(w.id, false).then(load)}
              >
                Remettre dans ma liste
              </button>
            </li>
          ))}
        </ul>
        <AddWishForm ownerId={me.id} received onAdded={load} />
      </details>

      <IdeasPanel person={{ ...me, is_me: true }} onAdded={load} />

      {shareToken !== undefined && <SharePanel token={shareToken} />}
    </div>
  );
}
