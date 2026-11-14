import { useState, useSyncExternalStore } from 'react';

const VIEWS = [
  { id: '1', label: '1 colonne', short: '1' },
  { id: '2', label: '2 colonnes', short: '2' },
  { id: '3', label: '3 colonnes', short: '3' },
  { id: 'compact', label: 'Compact, sans images', short: 'Compact' },
];
// Trois colonnes ne tiennent lisiblement qu'à partir de 480 px de large.
const WIDE_QUERY = '(min-width: 480px)';
const subscribeWide = (notify) => {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const isWide = () => window.matchMedia(WIDE_QUERY).matches;

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

// Le même choix (1, 2, 3 colonnes ou compact) pour toutes les listes de l'app.
export function useListView() {
  const [chosen, setChosen] = useState(readView);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => true);
  // Un « 3 colonnes » mémorisé retombe sur 2 colonnes quand l'écran est trop étroit.
  const view = chosen === '3' && !wide ? '2' : chosen;
  const choose = (id) => {
    setChosen(id);
    try {
      localStorage.setItem(VIEW_KEY, id);
    } catch {
      // Stockage indisponible : le choix vaut pour cette visite seulement.
    }
  };
  return { view, choose, wide };
}

export function ViewSwitch({ view, wide, onChoose }) {
  return (
    <div className="view-switch" role="group" aria-label="Affichage de la liste">
      {VIEWS.filter((v) => v.id !== '3' || wide).map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={view === v.id}
          aria-label={v.label}
          title={v.label}
          onClick={() => onChoose(v.id)}
        >
          {v.short}
        </button>
      ))}
    </div>
  );
}
