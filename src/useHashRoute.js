import { useEffect, useState } from 'react';

const parse = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [page, id] = hash.split('/');
  if (page === 'moi') return { page: 'me' };
  if (page === 'profil') return { page: 'profile' };
  if (page === 'p' && Number(id)) return { page: 'person', id: Number(id) };
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
