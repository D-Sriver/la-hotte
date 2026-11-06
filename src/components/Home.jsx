import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GiftTag from './GiftTag.jsx';

const countLabel = (n) => (n === 0 ? 'Liste vide' : n === 1 ? '1 idée' : `${n} idées`);

export default function Home() {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.people().then((d) => setPeople(d.people)).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!people) return <p className="muted">Chargement…</p>;

  const others = people.filter((p) => !p.is_me);

  return (
    <>
      <h1 className="display">Pour qui tu cherches&nbsp;?</h1>
      {others.length === 0 ? (
        <p className="lead">
          Personne d’autre n’a encore créé son profil. Envoie le lien de l’app à la famille :
          chacun se connecte avec son email.
        </p>
      ) : (
        <ul className="tag-grid">
          {others.map((p, i) => (
            <li key={p.id}>
              <GiftTag name={p.name} detail={countLabel(p.wish_count)} index={i} href={`#/p/${p.id}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
