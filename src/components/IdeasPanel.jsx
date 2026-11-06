import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { occasionFor, pick } from '../fun.js';
import { useStagger } from '../motion.js';

// Le ton suit l'occasion : les lutins à Noël, plus sobre pour un anniversaire.
const WORDING = {
  christmas: {
    button: 'Demander aux lutins',
    busy: 'Les lutins cherchent…',
    lines: ['Les lutins fouillent les rayons…', 'Un lutin compare les prix…', 'On secoue le Père Noël pour avoir des idées…', 'Les rennes votent…'],
  },
  birthday: {
    button: 'Trouver des idées',
    busy: 'On cherche…',
    lines: ['On fouille les rayons…', 'On compare les prix…', 'On cherche la perle rare…', 'On allume les bougies…'],
  },
};

export default function IdeasPanel({ person, onAdded }) {
  const [budget, setBudget] = useState(person.budget_hint || '');
  const [note, setNote] = useState('');
  const [state, setState] = useState({ loading: false, ideas: [], error: '', remaining: null });
  const [added, setAdded] = useState({});
  const listRef = useStagger(state.ideas.length);
  const occasion = occasionFor(person);
  const words = WORDING[occasion.kind];

  async function search(e) {
    e.preventDefault();
    setState({ loading: true, ideas: [], error: '', remaining: null });
    setAdded({});
    try {
      const data = await api.findIdeas({ person_id: person.id, budget, note, occasion: occasion.kind });
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
        price: idea.price,
        url: idea.url || idea.search_url,
        note: 'Idée trouvée avec l’IA',
      });
      setAdded((prev) => ({ ...prev, [index]: 'done' }));
      onAdded();
    } catch {
      setAdded((prev) => ({ ...prev, [index]: undefined }));
    }
  }

  const forMe = person.is_me;

  return (
    <section className="tile section ideas">
      <h2 className="section-title ideas-title">
        {occasion.kind === 'birthday' && !forMe ? `Une idée pour son anniversaire ?` : 'En panne d’idée\u00a0?'}
      </h2>
      <p className="muted small">
        {forMe
          ? 'L’IA propose des idées à partir de ton profil, pour t’inspirer ta liste. Prix approximatifs : vérifie avec « Chercher en ligne ».'
          : `L’IA propose des idées à partir du profil de ${person.name} et évite ce qui est déjà sur sa liste. Prix approximatifs : vérifie avec « Chercher en ligne ».`}
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
            <Icon name={state.loading ? 'search' : 'sparkle'} size={18} />
            {state.loading ? words.busy : words.button}
          </button>
        </div>
      </form>

      {state.loading && <p className="loading-line" role="status"><span className="spinner spinner-small" />{pick(words.lines)}</p>}
      {state.error && <p className="error" role="alert">{state.error}</p>}

      {state.ideas.length > 0 && (
        <ol className="idea-list" ref={listRef}>
          {state.ideas.map((idea, i) => (
            <li key={i} className="idea">
              <div className="idea-body">
              <p className="wish-title">{idea.title}</p>
              <p className="wish-meta">{[idea.price, idea.shop].filter(Boolean).join(', ')}</p>
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
                  {added[i] === 'done' ? <><Icon name="check" size={16} />Ajouté</> : forMe ? 'Ajouter à ma liste' : 'Je garde !'}
                </button>
              </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {state.remaining !== null && <p className="muted small">Recherches restantes aujourd’hui : {state.remaining}</p>}
    </section>
  );
}
