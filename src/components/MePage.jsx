import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import WishList from './WishList.jsx';
import AddWishForm from './AddWishForm.jsx';
import IdeasPanel from './IdeasPanel.jsx';
import ProfileForm from './ProfileForm.jsx';

export default function MePage({ me, onSaved }) {
  const [wishes, setWishes] = useState(null);
  const load = useCallback(() => {
    api.me().then((d) => setWishes(d.wishes));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <a href="#/" className="back">Toute la famille</a>
      <h1 className="display">Ma liste</h1>
      <p className="lead">Colle des liens de produits qui te font envie. Tu ne verras jamais ce que les autres réservent.</p>

      <section className="section">
        {wishes
          ? <WishList wishes={wishes} emptyText="Ta liste est vide. Ajoute une première envie." onChanged={load} />
          : <p className="muted">Chargement…</p>}
        <AddWishForm ownerId={me.id} onAdded={load} />
      </section>

      <section className="section">
        <h2 className="section-title">Mon profil</h2>
        <ProfileForm initial={me} onSaved={onSaved} />
      </section>

      <IdeasPanel person={{ ...me, is_me: true }} onAdded={load} />
    </>
  );
}
