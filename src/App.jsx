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
import InviteScreen from './components/InviteScreen.jsx';
import { clearInvite, pendingInvite } from './invite.js';
import Icon from './components/Icon.jsx';
import LogoutButton from './components/LogoutButton.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { gsap, useGSAP } from './motion.js';
import { zoomBackHome } from './zoom.js';

const TABS = [
  { page: 'home', href: '#/', label: 'Famille', icon: 'family' },
  { page: 'me', href: '#/moi', label: 'Ma liste', icon: 'gift' },
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
  // La page d'une personne et « Ce que j'offre » sont des sous-pages de Famille.
  const active = current === 'person' || current === 'gifts' ? 'home' : current;
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
            if (t.page === 'home' && current === 'person' && document.querySelector('[data-zoom-target]')) {
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
  // Lien d'invitation en attente : on vérifie le code avant d'afficher quoi que ce soit.
  const [invite, setInvite] = useState(() => (pendingInvite() ? 'checking' : null));

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

  // Une fois connecté : déjà membre, on bascule sur la famille ; sinon on pose la question.
  useEffect(() => {
    if (!me || invite !== 'checking') return;
    const code = pendingInvite();
    api.invitation(code)
      .then(({ family, member }) => {
        if (!member) return setInvite({ code, family });
        clearInvite();
        setInvite(null);
        if (me.family?.id !== family.id) showFamily(family);
      })
      .catch(() => {
        clearInvite();
        setInvite(null);
      });
  }, [me, invite, showFamily]);

  // Changer de famille. La page d'une personne ne vaut que dans sa famille : on revient à l'accueil,
  // ou on ouvre la page demandée (hash) une fois dans la bonne famille.
  const switchFamily = useCallback((id, hash) => {
    setFamily(id);
    if (hash) window.location.hash = hash;
    else if (route.page === 'person') window.location.hash = '#/';
    showFamily({ id });
  }, [route.page, showFamily]);

  const closeInvite = useCallback((family) => {
    clearInvite();
    setInvite(null);
    if (family) showFamily(family);
  }, [showFamily]);

  if (error === 'login') return <LoginScreen onLoggedIn={loadMe} />;
  if (error) return <main className="page page-center"><p className="error" role="alert">{error}</p></main>;
  if (!me || invite === 'checking') return <main className="page page-center"><div className="spinner" role="status" aria-label="Chargement" /></main>;
  if (invite) return <InviteScreen me={me} invite={invite} onJoined={closeInvite} onDeclined={() => closeInvite()} />;

  if (!me.family) {
    return (
      <main className="onboarding">
        <div className="onboarding-card">
          <img src="/icon.svg" alt="" width="56" height="56" />
          <h1 className="title">Bienvenue dans La Hotte</h1>
          <p className="lead">Les listes de cadeaux de ta famille, sans gâcher les surprises. Rejoins ta famille avec le lien ou le code reçu, ou crée-la et invite les autres.</p>
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
            Ton prénom, et ce que tu aimes si tu veux : la famille s’en servira pour te trouver des cadeaux.
          </p>
          <ProfileForm
            initial={me}
            quick
            submitLabel="C’est parti"
            onSaved={(saved) => { setMe(saved); window.scrollTo(0, 0); }}
          />
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
          <FamilySwitcher me={me} onSwitch={(id) => switchFamily(id)} />
        </div>
        <Nav current={route.page} />
      </header>
      {/* Changer de famille recharge toutes les pages avec les bonnes personnes. */}
      <InstallPrompt />
      <main className="page" key={me.family.id}>
        {route.page === 'home' && <Home me={me} />}
        {route.page === 'me' && <MePage me={me} />}
        {route.page === 'gifts' && <GiftsPage familyId={me.family.id} onSwitchFamily={switchFamily} />}
        {route.page === 'profile' && <ProfilePage me={me} onSaved={setMe} onFamiliesChanged={showFamily} />}
        {route.page === 'person' && <PersonPage key={route.id} id={route.id} />}
      </main>
    </div>
  );
}
