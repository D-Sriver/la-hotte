import { useEffect, useState } from 'react';

const parse = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [page, id] = hash.split('/');
  if (page === 'moi') return { page: 'me' };
  if (page === 'cadeaux') return { page: 'gifts' };
  if (page === 'profil') return { page: 'profile' };
  if (page === 'p' && Number(id)) return { page: 'person', id: Number(id) };
  // Adresse inconnue : on affiche l'accueil, et l'adresse le dit aussi.
  if (hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  return { page: 'home' };
};

export function useHashRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
