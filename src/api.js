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
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
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
  preview: (url) => request('/preview', { method: 'POST', body: { url } }),
  photoUrl: (id) => `/api/wishes/${id}/photo${devAs ? `?as=${encodeURIComponent(devAs)}` : ''}`,
  findIdeas: (query) => request('/ideas', { method: 'POST', body: query }),
};
