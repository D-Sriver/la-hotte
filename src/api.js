import { announceFresh, announceStale, canKeep, keep, recall } from './offline.js';

// En local (serveur en DEV_MODE), ?as=email@test.fr permet de jouer un autre membre de la famille.
const devAs = new URLSearchParams(window.location.search).get('as');

// La famille affichée, retenue sur cet appareil (le serveur retombe sur la première sinon).
const FAMILY_KEY = 'la-hotte-family';
let familyId = null;
try {
  familyId = Number(localStorage.getItem(FAMILY_KEY)) || null;
} catch {
  /* stockage indisponible */
}

export function setFamily(id) {
  familyId = id;
  try {
    localStorage.setItem(FAMILY_KEY, String(id));
  } catch {
    /* stockage indisponible */
  }
}

function send(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (devAs) headers['x-dev-email'] = devAs;
  if (familyId) headers['x-family'] = String(familyId);
  return fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function failure(res) {
  const data = await res.json().catch(() => ({}));
  const error = new Error(data.error || `Erreur ${res.status}`);
  // 401 + login : il faut afficher l'écran de connexion par email.
  error.needsLogin = res.status === 401 && data.login === true;
  return error;
}

const NO_NETWORK = 'Pas de connexion : réessaie quand le réseau revient.';

async function request(path, options = {}) {
  const readable = canKeep(path, options.method || 'GET');
  let res;
  try {
    res = await send(path, options);
  } catch (err) {
    // Hors connexion : pour la lecture, la dernière version gardée sur cet appareil.
    const kept = readable && recall(familyId, path);
    if (kept) {
      announceStale(kept.at);
      return kept.data;
    }
    throw new Error(err instanceof TypeError ? NO_NETWORK : err.message);
  }
  announceFresh();
  if (!res.ok) throw await failure(res);
  const data = await res.json().catch(() => ({}));
  if (readable) keep(familyId, path, data);
  return data;
}

// Réponse ligne par ligne (une ligne JSON par événement) : onEvent est appelé pour chacune.
async function stream(path, options, onEvent) {
  const res = await send(path, options);
  if (!res.ok) throw await failure(res);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

// Premier écran : on lance les requêtes de l'accueil tout de suite, en parallèle, avant même le rendu React.
// Chaque réponse ne sert qu'une fois (au premier appel) ; ensuite on redemande normalement.
const early = {};
export function prefetchHome() {
  for (const [key, path] of [
    ['me', '/me'],
    ['people', '/people'],
    ['reservations', '/reservations'],
  ]) {
    early[key] = request(path);
    early[key].catch(() => {}); // l'erreur sera traitée par celui qui la reprend
  }
}
const once = (key, path) => () => {
  const pending = early[key];
  delete early[key];
  return pending || request(path);
};

export const api = {
  me: once('me', '/me'),
  invitation: (code) => request(`/join?code=${encodeURIComponent(code)}`),
  join: (code) => request('/join', { method: 'POST', body: { code } }),
  createFamily: (name) => request('/families', { method: 'POST', body: { name } }),
  renameFamily: (id, name) => request(`/families/${id}`, { method: 'PUT', body: { name } }),
  leaveFamily: (id) => request(`/families/${id}`, { method: 'DELETE' }),
  saveMe: (profile) => request('/me', { method: 'PUT', body: profile }),
  people: once('people', '/people'),
  person: (id) => request(`/people/${id}`),
  addWish: (wish) => request('/wishes', { method: 'POST', body: wish }),
  updateWish: (id, wish) => request(`/wishes/${id}`, { method: 'PUT', body: wish }),
  deleteWish: (id) => request(`/wishes/${id}`, { method: 'DELETE' }),
  // action : reserve, group, join, leave, amount, bought, given ou occasion (extra : { amount } ou { occasion })
  gift: (id, action, amount, extra = {}) =>
    request(`/wishes/${id}/reserve`, { method: 'POST', body: { action, amount, ...extra } }),
  reservations: once('reservations', '/reservations'),
  messages: (id) => request(`/wishes/${id}/messages`),
  sendMessage: (id, body) => request(`/wishes/${id}/messages`, { method: 'POST', body: { body } }),
  deleteMessage: (id, messageId) => request(`/wishes/${id}/messages?message=${messageId}`, { method: 'DELETE' }),
  setReceived: (id, received) => request(`/wishes/${id}/received`, { method: 'POST', body: { received } }),
  loginStart: (email) => request('/auth/start', { method: 'POST', body: { email } }),
  loginVerify: (email, code) => request('/auth/verify', { method: 'POST', body: { email, code } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  pushStatus: () => request('/push'),
  pushSubscribe: (subscription) => request('/push', { method: 'POST', body: subscription }),
  pushUnsubscribe: (endpoint) => request('/push', { method: 'DELETE', body: { endpoint } }),
  pushTest: () => request('/push/test', { method: 'POST' }),
  // { reminders, messages, groups } : seuls les choix envoyés changent.
  setNotify: (choices) => request('/me/notifications', { method: 'PUT', body: choices }),
  thank: (id) => request(`/wishes/${id}/thanks`, { method: 'POST' }),
  calendar: (enabled) => request('/me/calendar', { method: 'POST', body: { enabled } }),
  shareList: (enabled) => request('/me/share', { method: 'POST', body: { enabled } }),
  reportError: (report) => request('/errors', { method: 'POST', body: report }),
  preview: (url) => request('/preview', { method: 'POST', body: { url } }),
  photoUrl: (wishId, photoId) =>
    `/api/wishes/${wishId}/photo?p=${photoId}${devAs ? `&as=${encodeURIComponent(devAs)}` : ''}`,
  // onEvent reçoit { idea }, puis { done, remaining } ou { error }.
  findIdeas: (query, onEvent) => stream('/ideas', { method: 'POST', body: query }, onEvent),
  ideaHistory: (personId) => request(`/ideas?person_id=${personId}`),
  rateIdea: (id, change) => request(`/ideas/${id}`, { method: 'PUT', body: change }),
};
