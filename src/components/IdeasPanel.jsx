import { useEffect, useState } from 'react';
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

const IDLE = { loading: false, ideas: [], error: '', remaining: null };

export default function IdeasPanel({ person, onAdded }) {
  const [budget, setBudget] = useState(person.budget_hint || '');
  const [note, setNote] = useState('');
  const [state, setState] = useState(IDLE);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState({});
  const listRef = useStagger(state.ideas.length);
  const occasion = occasionFor(person);
  const words = WORDING[occasion.kind];
  const forMe = person.is_me;

  useEffect(() => {
    let alive = true;
    setState(IDLE);
    api.ideaHistory(person.id).then((data) => alive && setHistory(data.ideas)).catch(() => {});
    return () => { alive = false; };
  }, [person.id]);

  // Une idée a changé (avis, gardée) : on la met à jour partout où elle s'affiche.
  function patch(id, change) {
    const apply = (list) => list.map((idea) => (idea.id === id ? { ...idea, ...change } : idea));
    setState((prev) => ({ ...prev, ideas: apply(prev.ideas) }));
    setHistory(apply);
  }

  async function search(e) {
    e.preventDefault();
    // Les idées de la recherche précédente rejoignent l'historique.
    setHistory((prev) => [...state.ideas.filter((i) => !prev.some((p) => p.id === i.id)), ...prev]);
    setState({ ...IDLE, loading: true });
    try {
      await api.findIdeas({ person_id: person.id, budget, note, occasion: occasion.kind }, (event) => {
        if (event.idea) setState((prev) => ({ ...prev, ideas: [...prev.ideas, event.idea] }));
        if (event.done) setState((prev) => ({ ...prev, loading: false, remaining: event.remaining }));
        if (event.error) setState((prev) => ({ ...prev, loading: false, error: event.error }));
      });
      setState((prev) => ({ ...prev, loading: false }));
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  }

  async function keep(idea) {
    setSaving((prev) => ({ ...prev, [idea.id]: true }));
    try {
      await api.addWish({
        owner_id: person.id,
        title: idea.title,
        price: idea.price,
        url: idea.search_url,
        note: 'Idée trouvée avec l’IA',
      });
      patch(idea.id, { kept: true });
      api.rateIdea(idea.id, { kept: true }).catch(() => {});
      onAdded();
    } finally {
      setSaving((prev) => ({ ...prev, [idea.id]: false }));
    }
  }

  async function rate(idea, value) {
    const rating = idea.rating === value ? null : value;
    patch(idea.id, { rating });
    try {
      await api.rateIdea(idea.id, { rating });
    } catch {
      patch(idea.id, { rating: idea.rating });
    }
  }

  const card = (idea) => (
    <IdeaCard key={idea.id} idea={idea} forMe={forMe} saving={!!saving[idea.id]} onKeep={keep} onRate={rate} />
  );
  const older = history.filter((idea) => !state.ideas.some((i) => i.id === idea.id));

  return (
    <section className="tile section ideas">
      <h2 className="section-title ideas-title">
        {occasion.kind === 'birthday' && !forMe ? `Une idée pour son anniversaire ?` : 'En panne d’idée ?'}
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

      {state.ideas.length > 0 && <ol className="idea-list" ref={listRef}>{state.ideas.map(card)}</ol>}
      {state.loading && <p className="loading-line" role="status"><span className="spinner spinner-small" />{pick(words.lines)}</p>}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.remaining !== null && <p className="muted small">Recherches restantes aujourd’hui : {state.remaining}</p>}
      {state.ideas.length > 0 && !state.loading && (
        <p className="muted small">👍 et 👎 aident l’IA à mieux viser la prochaine fois.</p>
      )}

      {older.length > 0 && (
        <details className="idea-history">
          <summary>Idées déjà proposées <span className="count">{older.length}</span></summary>
          <ol className="idea-list">{older.map(card)}</ol>
        </details>
      )}
    </section>
  );
}

function IdeaCard({ idea, forMe, saving, onKeep, onRate }) {
  return (
    <li className="idea">
      <div className="idea-body">
        <p className="wish-title">{idea.title}</p>
        <p className="wish-meta">{[idea.price, idea.shop].filter(Boolean).join(', ')}</p>
        {idea.why && <p className="idea-why">{idea.why}</p>}
        <div className="idea-actions">
          <a className="text-link" href={idea.search_url} target="_blank" rel="noopener noreferrer">Chercher en ligne</a>
          <span className="idea-buttons">
            <button
              className={`idea-rate${idea.rating === 1 ? ' is-on' : ''}`}
              aria-pressed={idea.rating === 1}
              aria-label="Bonne idée"
              title="Bonne idée"
              onClick={() => onRate(idea, 1)}
            >
              <Icon name="thumbUp" size={17} />
            </button>
            <button
              className={`idea-rate${idea.rating === -1 ? ' is-on' : ''}`}
              aria-pressed={idea.rating === -1}
              aria-label="À côté"
              title="À côté"
              onClick={() => onRate(idea, -1)}
            >
              <Icon name="thumbDown" size={17} />
            </button>
            <button
              className={`button button-small${idea.kept ? ' button-done' : ''}`}
              disabled={idea.kept || saving}
              onClick={() => onKeep(idea)}
            >
              {idea.kept ? <><Icon name="check" size={16} />Ajouté</> : forMe ? 'Ajouter à ma liste' : 'Je garde !'}
            </button>
          </span>
        </div>
      </div>
    </li>
  );
}
