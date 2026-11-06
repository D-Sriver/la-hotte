// En local (serveur en DEV_MODE), ?as=email@test.fr permet de jouer un autre membre de la famille.
const devAs = new URLSearchParams(window.location.search).get('as');

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (devAs) headers['x-dev-email'] = devAs;
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
  saveMe: (profile) => request('/me', { method: 'PUT', body: profile }),
  people: () => request('/people'),
  person: (id) => request(`/people/${id}`),
  addWish: (wish) => request('/wishes', { method: 'POST', body: wish }),
  deleteWish: (id) => request(`/wishes/${id}`, { method: 'DELETE' }),
  toggleReserve: (id) => request(`/wishes/${id}/reserve`, { method: 'POST' }),
  findIdeas: (query) => request('/ideas', { method: 'POST', body: query }),
};
