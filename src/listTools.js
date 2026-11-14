// Tri et filtre de « Ma liste » : des fonctions pures, sans rien changer à ce que le serveur renvoie.

export const SORTS = [
  { id: 'default', label: 'Coups de cœur d’abord' },
  { id: 'recent', label: 'Plus récentes' },
  { id: 'old', label: 'Plus anciennes' },
  { id: 'price-up', label: 'Prix croissant' },
  { id: 'price-down', label: 'Prix décroissant' },
  { id: 'az', label: 'A → Z' },
];

// Le premier nombre d'un prix saisi à la main (« ≈ 30 € », « 24,90 », « 20-40 € ») ; null s'il n'y en a pas.
export function priceNumber(text) {
  const match = String(text || '')
    .replace(/\s/g, '')
    .match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

const plain = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Celles sans prix passent toujours en dernier, quel que soit le sens du tri.
const byPrice = (direction) => (a, b) => {
  const pa = priceNumber(a.price);
  const pb = priceNumber(b.price);
  if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
  return (pa - pb) * direction;
};

const SORTERS = {
  default: null,
  recent: (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
  old: (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
  'price-up': byPrice(1),
  'price-down': byPrice(-1),
  az: (a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }),
};

export function arrangeWishes(wishes, { sort = 'default', onlyFavorites = false, query = '' } = {}) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  const kept = wishes.filter(
    (w) => (!onlyFavorites || w.favorite) && words.every((word) => plain(`${w.title} ${w.note || ''}`).includes(word)),
  );
  const sorter = SORTERS[sort];
  return sorter ? [...kept].sort(sorter) : kept;
}
