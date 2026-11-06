import { useState } from 'react';
import { api } from '../api.js';

export default function IdeasPanel({ person, onAdded }) {
  const [budget, setBudget] = useState(person.budget_hint || '');
  const [note, setNote] = useState('');
  const [state, setState] = useState({ loading: false, ideas: [], error: '', remaining: null });
  const [added, setAdded] = useState({});

  async function search(e) {
    e.preventDefault();
    setState({ loading: true, ideas: [], error: '', remaining: null });
    setAdded({});
    try {
      const data = await api.findIdeas({ person_id: person.id, budget, note });
      setState({ loading: false, ideas: data.ideas, error: '', remaining: data.remaining });
    } catch (err) {
      setState({ loading: false, ideas: [], error: err.message, remaining: null });
    }
  }

  async function keep(idea, index) {
    setAdded({ ...added, [index]: 'saving' });
    try {
      await api.addWish({
        owner_id: person.id,
        title: idea.title,
        url: idea.url || '',
        price: idea.price,
        note: idea.shop ? `Trouvé chez ${idea.shop}` : '',
      });
      setAdded((prev) => ({ ...prev, [index]: 'done' }));
      onAdded();
    } catch {
      setAdded((prev) => ({ ...prev, [index]: undefined }));
    }
  }

  const forMe = person.is_me;

  return (
    <section className="section ideas">
      <h2 className="section-title">Trouver des idées</h2>
      <p className="muted">
        {forMe
          ? 'Claude cherche sur le web à partir de ton profil, pour t’inspirer ta liste.'
          : `Claude cherche sur le web à partir du profil de ${person.name} et évite ce qui est déjà sur sa liste.`}
      </p>
      <form className="form" onSubmit={search}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Budget</span>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="ex. 30 à 60 €" maxLength={60} />
          </label>
          <label className="field field-grow">
            <span className="field-label">Une précision ?</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. plutôt un objet déco" maxLength={300} />
          </label>
        </div>
        <div className="form-actions">
          <button className="button button-accent" disabled={state.loading}>
            {state.loading ? 'Recherche en cours…' : 'Chercher des idées'}
          </button>
        </div>
      </form>

      {state.loading && <p className="muted" role="status">Ça prend souvent 30 secondes à une minute.</p>}
      {state.error && <p className="error" role="alert">{state.error}</p>}

      {state.ideas.length > 0 && (
        <ol className="idea-list">
          {state.ideas.map((idea, i) => (
            <li key={i} className="idea">
              <p className="wish-title">{idea.title}</p>
              <p className="wish-meta">{[idea.price, idea.shop].filter(Boolean).join(' – ')}</p>
              {idea.why && <p className="idea-why">{idea.why}</p>}
              <div className="idea-actions">
                {idea.url
                  ? <a className="text-link" href={idea.url} target="_blank" rel="noopener noreferrer">Voir le produit</a>
                  : <a className="text-link" href={idea.search_url} target="_blank" rel="noopener noreferrer">Chercher en ligne</a>}
                <button
                  className={`button button-small${added[i] === 'done' ? ' button-done' : ''}`}
                  disabled={Boolean(added[i])}
                  onClick={() => keep(idea, i)}
                >
                  {added[i] === 'done' ? 'Ajouté' : forMe ? 'Ajouter à ma liste' : 'Garder l’idée'}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {state.remaining !== null && <p className="muted small">Recherches restantes aujourd’hui : {state.remaining}</p>}
    </section>
  );
}
