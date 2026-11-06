import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useHashRoute } from './useHashRoute.js';
import Home from './components/Home.jsx';
import PersonPage from './components/PersonPage.jsx';
import MePage from './components/MePage.jsx';
import ProfileForm from './components/ProfileForm.jsx';

export default function App() {
  const route = useHashRoute();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  const loadMe = useCallback(() => {
    api.me().then((data) => setMe(data.me)).catch((err) => setError(err.message));
  }, []);
  useEffect(loadMe, [loadMe]);

  if (error) return <main className="page"><p className="error" role="alert">{error}</p></main>;
  if (!me) return <main className="page"><p className="muted">Chargement…</p></main>;

  if (!me.name) {
    return (
      <main className="page">
        <h1 className="display">Bienvenue dans La Hotte</h1>
        <p className="lead">
          Dis-nous ce que tu aimes. La famille s’en servira pour te trouver des cadeaux,
          et toi pour leur en trouver.
        </p>
        <ProfileForm initial={me} submitLabel="Créer mon profil" onSaved={setMe} />
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <a href="#/" className="wordmark">La Hotte</a>
        <a href="#/moi" className="topbar-link">Mon profil</a>
      </header>
      <main className="page">
        {route.page === 'home' && <Home />}
        {route.page === 'me' && <MePage me={me} onSaved={setMe} />}
        {route.page === 'person' && <PersonPage key={route.id} id={route.id} />}
      </main>
    </>
  );
}
