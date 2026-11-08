import { api } from './api.js';

// Les erreurs du navigateur partent dans le journal de La Hotte (npm run errors).
// Une même erreur n'est envoyée qu'une fois par visite, et au plus 10 en tout.
const sent = new Set();

export function reportError(error, extra = '') {
  const message = String(error?.message || error || '').slice(0, 500);
  if (!message || sent.has(message) || sent.size >= 10) return;
  // Bruit connu des navigateurs, sans conséquence pour la page.
  if (/ResizeObserver loop|Script error\.?$|Load failed|Failed to fetch|NetworkError/i.test(message)) return;
  sent.add(message);
  const stack = [error?.stack, extra].filter(Boolean).join('\n').slice(0, 4000);
  api.reportError({ message, stack, page: window.location.hash || '/' }).catch(() => {});
}

export function watchErrors() {
  window.addEventListener('error', (event) => reportError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}
