import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Pas d'animations d'entrée au tout premier affichage : on retire la classe après deux images.
document.documentElement.classList.add('first-load');
requestAnimationFrame(() => requestAnimationFrame(() => {
  setTimeout(() => document.documentElement.classList.remove('first-load'), 600);
}));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
