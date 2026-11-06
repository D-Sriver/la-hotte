import { useCallback, useEffect, useRef, useState } from 'react';
import { api, setFamily } from './api.js';
import { useHashRoute } from './useHashRoute.js';
import Home from './components/Home.jsx';
import PersonPage from './components/PersonPage.jsx';
import MePage from './components/MePage.jsx';
import GiftsPage from './components/GiftsPage.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import ProfileForm from './components/ProfileForm.jsx';
import JoinForm from './components/JoinForm.jsx';
import Icon from './components/Icon.jsx';
import LogoutButton from './components/LogoutButton.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { gsap, useGSAP } from './motion.js';
import { zoomBackHome } from './zoom.js';

const TABS = [
  { page: 'home', href: '#/', label: 'Famille', icon: 'family' },
  { page: 'me', href: '#/moi', label: 'Ma liste', icon: 'gift' },
  { page: 'gifts', href: '#/cadeaux', label: 'À offrir', icon: 'bag' },
  { page: 'profile', href: '#/profil', label: 'Profil', icon: 'user' },
];

function Logo() {
  return (
    <a href="#/" className="logo">
      <img src="/icon.svg" alt="" width="30" height="30" />
      <span>La Hotte</span>
    </a>
  );
}

// Choix de la famille affichée (seulement si on en a plusieurs).
function FamilySwitcher({ me, onSwitch }) {
  if (me.families.length < 2) return null;
  return (
    <label className="family-switch">
      <span className="sr-only">Famille affichée</span>
      <Icon name="family" size={16} />
      <select value={me.family.id} onChange={(e) => onSwitch(Number(e.target.value))}>
        {me.families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </label>
  );
}

function Nav({ current }) {
  const active = current === 'person' ? 'home' : current;
  const nav = useRef(null);
  const pill = useRef(null);
  const placed = useRef(false);

  // La pastille glisse jusqu'à l'onglet actif (placée sans animation au premier affichage).
  useGSAP(() => {
    const move = () => {
      const tab = nav.current.querySelector('[aria-current="page"]');
      if (!tab) return;
      const target = { x: tab.offsetLeft, y: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight };
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!placed.current || reduce) gsap.set(pill.current, target);
      else gsap.to(pill.current, { ...target, duration: 0.45, ease: 'back.out(1.4)' });
      placed.current = true;
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, { dependencies: [active], scope: nav });

  return (
    <nav className="tabs" aria-label="Navigation principale" ref={nav}>
      <span className="tab-pill" ref={pill} aria-hidden="true" />
      {TABS.map((t) => (
        <a
          key={t.page}
          href={t.href}
          className="tab"
          aria-current={active === t.page ? 'page' : undefined}
          onClick={(e) => {
            // Depuis la page d'une personne, l'onglet Famille joue l'entonnoir inverse.
            if (t.page === 'home' && current === 'person') {
              e.preventDefault();
              zoomBackHome();
            }
          }}
        >
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function App() {
  const route = useHashRoute();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  const loadMe = useCallback(() => {
    setError('');
    api.me().then((data) => setMe(data.me)).catch((err) => setError(err.needsLogin ? 'login' : err.message));
  }, []);
  useEffect(loadMe, [loadMe]);

  // Après avoir créé, rejoint ou choisi une famille : on l'affiche.
  const showFamily = useCallback((family) => {
    if (family?.id) setFamily(family.id);
    loadMe();
  }, [loadMe]);

  if (error === 'login') return <LoginScreen onLoggedIn={loadMe} />;
  if (error) return <main className="page page-center"><p className="error" role="alert">{error}</p></main>;
  if (!me) return <main className="page page-center"><div className="spinner" role="status" aria-label="Chargement" /></main>;

  if (!me.family) {
    return (
      <main className="onboarding">
        <div className="onboarding-card">
          <img src="/icon.svg" alt="" width="56" height="56" />
          <h1 className="title">Bienvenue dans La Hotte</h1>
          <p className="lead">Les listes de cadeaux de ta famille, sans gâcher les surprises. Rejoins ta famille avec son code, ou crée-la et partage le code.</p>
          <JoinForm onJoined={showFamily} />
          <LogoutButton email={me.email} emailLogin={me.email_login} quiet />
        </div>
      </main>
    );
  }

  if (!me.name) {
    return (
      <main className="onboarding">
          <div className="onboarding-card">
          <img src="/icon.svg" alt="" width="56" height="56" />
          <h1 className="title">Bienvenue dans La Hotte</h1>
          <p className="lead">
            Dis-nous ce que tu aimes. La famille s’en servira pour te trouver des cadeaux,
            et toi pour leur en trouver.
          </p>
          <ProfileForm initial={me} submitLabel="Créer mon profil" onSaved={setMe} />
          <LogoutButton email={me.email} emailLogin={me.email_login} quiet />
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="appbar">
        <div className="appbar-start">
          <Logo />
          <FamilySwitcher me={me} onSwitch={(id) => showFamily({ id })} />
        </div>
        <Nav current={route.page} />
      </header>
      {/* Changer de famille recharge toutes les pages avec les bonnes personnes. */}
      <InstallPrompt />
      <main className="page" key={me.family.id}>
        {route.page === 'home' && <Home me={me} />}
        {route.page === 'me' && <MePage me={me} />}
        {route.page === 'gifts' && <GiftsPage />}
        {route.page === 'profile' && <ProfilePage me={me} onSaved={setMe} onFamiliesChanged={showFamily} />}
        {route.page === 'person' && <PersonPage key={route.id} id={route.id} />}
      </main>
    </div>
  );
}
