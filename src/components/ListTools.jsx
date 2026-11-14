import Icon from './Icon.jsx';
import { SORTS } from '../listTools.js';

// Rechercher, trier, ne garder que les coups de cœur : seulement quand la liste commence à être longue.
export default function ListTools({ query, onQuery, sort, onSort, onlyFavorites, onFavorites }) {
  return (
    <div className="list-tools">
      <input
        type="search"
        className="list-search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Rechercher dans ma liste"
        aria-label="Rechercher dans ma liste"
        maxLength={80}
      />
      <label className="list-sort">
        <span className="sr-only">Trier par</span>
        <select value={sort} onChange={(e) => onSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="list-chip"
        aria-pressed={onlyFavorites}
        onClick={() => onFavorites(!onlyFavorites)}
      >
        <Icon name="star" size={15} />
        Coups de cœur
      </button>
    </div>
  );
}
