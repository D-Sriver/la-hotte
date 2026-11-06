// En local (serveur en DEV_MODE), ?as=email@test.fr permet de jouer un autre membre de la famille.
const devAs = new URLSearchParams(window.location.search).get('as');

// La famille affichée, retenue sur cet appareil (le serveur retombe sur la première sinon).
const FAMILY_KEY = 'la-hotte-family';
let familyId = null;
try { familyId = Number(localStorage.getItem(FAMILY_KEY)) || null; } catch { /* stockage indisponible */ }

export function setFamily(id) {
  familyId = id;
  try { localStorage.setItem(FAMILY_KEY, String(id)); } catch { /* stockage indisponible */ }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (devAs) headers['x-dev-email'] = devAs;
  if (familyId) headers['x-family'] = String(familyId);
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Erreur ${res.status}`);
    // 401 + login : il faut afficher l'écran de connexion par email.
    error.needsLogin = res.status === 401 && data.login === true;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request('/me'),
  join: (code) => request('/join', { method: 'POST', body: { code } }),
  createFamily: (name) => request('/families', { method: 'POST', body: { name } }),
  renameFamily: (id, name) => request(`/families/${id}`, { method: 'PUT', body: { name } }),
  leaveFamily: (id) => request(`/families/${id}`, { method: 'DELETE' }),
  saveMe: (profile) => request('/me', { method: 'PUT', body: profile }),
  people: () => request('/people'),
  person: (id) => request(`/people/${id}`),
  addWish: (wish) => request('/wishes', { method: 'POST', body: wish }),
  updateWish: (id, wish) => request(`/wishes/${id}`, { method: 'PUT', body: wish }),
  deleteWish: (id) => request(`/wishes/${id}`, { method: 'DELETE' }),
  // action : reserve, group, join, leave, amount ou bought (amount en euros, pour join et amount)
  gift: (id, action, amount) => request(`/wishes/${id}/reserve`, { method: 'POST', body: { action, amount } }),
  reservations: () => request('/reservations'),
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
  preview: (url) => request('/preview', { method: 'POST', body: { url } }),
  photoUrl: (id) => `/api/wishes/${id}/photo${devAs ? `?as=${encodeURIComponent(devAs)}` : ''}`,
  findIdeas: (query) => request('/ideas', { method: 'POST', body: query }),
};
