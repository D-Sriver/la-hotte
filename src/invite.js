// Lien d'invitation : https://…/?rejoindre=K7PQ-M3XA.
// Le code passe par la requête (pas le #) pour survivre à la page de connexion de Cloudflare Access,
// puis il est mis de côté sur l'appareil le temps de se connecter.

const PARAM = 'rejoindre';
const KEY = 'la-hotte-invite';

export const inviteLink = (code) => `${window.location.origin}/?${PARAM}=${encodeURIComponent(code)}`;

function keepCodeFromUrl() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get(PARAM);
  if (!code) return;
  try { localStorage.setItem(KEY, code); } catch { /* stockage indisponible */ }
  url.searchParams.delete(PARAM);
  window.history.replaceState(null, '', url);
}
keepCodeFromUrl();

export function pendingInvite() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

// Invitation refusée (souvent par erreur) : on la garde pour pouvoir changer d'avis sans redemander le code.
const DECLINED = 'la-hotte-declined';

export function rememberDeclined(code, familyName) {
  try { localStorage.setItem(DECLINED, JSON.stringify({ code, name: familyName })); } catch { /* stockage indisponible */ }
}

export function declinedInvite() {
  try { return JSON.parse(localStorage.getItem(DECLINED)); } catch { return null; }
}

export function forgetDeclined() {
  try { localStorage.removeItem(DECLINED); } catch { /* stockage indisponible */ }
}

export function clearInvite() {
  try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
}
