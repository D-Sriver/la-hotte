import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import ReceivedItem from './ReceivedItem.jsx';
import { useListView, ViewSwitch } from './ListView.jsx';
import ListTools from './ListTools.jsx';
import { arrangeWishes } from '../listTools.js';
import IdeasPanel from './IdeasPanel.jsx';
import SharePanel from './SharePanel.jsx';
import Icon from './Icon.jsx';
import Skeleton from './Skeleton.jsx';
import { profileCompletion } from '../profile.js';
import PageHead from './PageHead.jsx';
import { usePageIntro } from '../motion.js';
import { usePageTitle } from '../usePageTitle.js';

export default function MePage({ me }) {
  usePageTitle('Ma liste');
  const [wishes, setWishes] = useState(null);
  const [archived, setArchived] = useState([]);
  const { view, choose, wide } = useListView();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
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
  const shown = wishes && arrangeWishes(wishes, { sort, onlyFavorites, query });
  const filtering = !!query.trim() || onlyFavorites;
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
          <h2 className="section-title">
            Mes envies
            {wishes ? (
              <span className="count">{filtering ? `${shown.length} sur ${wishes.length}` : wishes.length}</span>
            ) : null}
          </h2>
          <ViewSwitch view={view} wide={wide} onChoose={choose} />
        </div>
        {wishes?.length >= 3 && (
          <ListTools
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            onlyFavorites={onlyFavorites}
            onFavorites={setOnlyFavorites}
          />
        )}
        {wishes ? (
          <WishList
            wishes={shown}
            emptyText={
              filtering
                ? 'Aucune envie ne correspond.'
                : 'Liste vide. Ajoute une envie, sinon ce sera la surprise totale.'
            }
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
            <ReceivedItem key={w.id} wish={w} onChanged={load} />
          ))}
        </ul>
        <AddWishForm ownerId={me.id} received onAdded={load} />
      </details>

      <IdeasPanel person={{ ...me, is_me: true }} onAdded={load} />

      {shareToken !== undefined && <SharePanel token={shareToken} />}
    </div>
  );
}
