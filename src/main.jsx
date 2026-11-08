import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { prefetchHome } from './api.js';
import { watchErrors } from './errors.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Polices hébergées sur le site (pas d'appel à Google) : latin, et latin étendu pour « œ » (cœur…).
import '@fontsource/unbounded/latin-700.css';
import '@fontsource/unbounded/latin-ext-700.css';
import '@fontsource/unbounded/latin-800.css';
import '@fontsource/unbounded/latin-ext-800.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-ext-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-ext-500.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/latin-ext-600.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/onest/latin-ext-700.css';
import './styles.css';

// Pas d'animations d'entrée au tout premier affichage : on retire la classe après deux images.
document.documentElement.classList.add('first-load');
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    setTimeout(() => document.documentElement.classList.remove('first-load'), 600);
  }),
);

watchErrors();

// Le service worker affiche les notifications (rappels de Noël, anniversaires…).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// Sur l'accueil, les données partent avant le rendu (un aller-retour de gagné sur le premier écran).
if (['', '#', '#/'].includes(window.location.hash)) prefetchHome();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
