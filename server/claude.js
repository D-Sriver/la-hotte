const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM = `Tu aides une famille française à trouver des idées de cadeaux.
Utilise la recherche web pour trouver des produits réels, actuellement en vente,
livrables en France, chez des boutiques fiables (de préférence françaises ou européennes).
Respecte le budget. Évite ce que la personne possède déjà, ce qu'elle n'aime pas,
et ce qui est déjà sur sa liste ou déjà réservé.
Varie les idées (pas 5 fois le même type d'objet).
N'invente jamais de lien : chaque url doit être une page produit vue dans tes résultats de recherche.
Si tu n'as pas de lien fiable pour une idée, mets "url": null.

Termine ta réponse par un bloc exactement de cette forme, et rien après :
<ideas>
[{"title": "...", "why": "une phrase qui relie l'idée à ses goûts", "price": "≈ 35 €", "shop": "Nom de la boutique", "url": "https://..."}]
</ideas>`;

function buildPrompt({ person, wishes, budget, note }) {
  const lines = [
    `Cherche 5 idées de cadeaux pour ${person.name}.`,
    `Ce qu'il/elle aime : ${person.likes || 'non précisé'}`,
    `À éviter : ${person.dislikes || 'rien de précisé'}`,
    `Possède déjà : ${person.owns || 'non précisé'}`,
    `Tailles : ${person.sizes || 'non précisé'}`,
    `Budget : ${budget || person.budget_hint || 'libre, raisonnable'}`,
  ];
  if (wishes.length) {
    lines.push(`Déjà sur sa liste (ne pas reproposer) : ${wishes.map((w) => w.title).join(' ; ')}`);
  }
  if (note) lines.push(`Précision de la personne qui offre : ${note}`);
  return lines.join('\n');
}

function collectSearchUrls(content) {
  const urls = new Set();
  for (const block of content) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const result of block.content) if (result.url) urls.add(result.url);
  }
  for (const block of content) {
    if (block.type !== 'text' || !Array.isArray(block.citations)) continue;
    for (const c of block.citations) if (c.url) urls.add(c.url);
  }
  return urls;
}

function parseIdeas(text) {
  const match = text.match(/<ideas>([\s\S]*?)<\/ideas>/);
  const raw = (match ? match[1] : text).replace(/```json|```/g, '').trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const sameUrl = (a, b) => a.replace(/[?#].*$/, '').replace(/\/$/, '') === b.replace(/[?#].*$/, '').replace(/\/$/, '');

export async function findIdeas(env, input) {
  const messages = [{ role: 'user', content: buildPrompt(input) }];
  let content = [];

  // pause_turn : l'API peut rendre la main au milieu d'une longue recherche, on relance.
  for (let round = 0; round < 3; round++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL || 'claude-sonnet-5-5',
        max_tokens: 4000,
        system: SYSTEM,
        messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 6,
            user_location: { type: 'approximate', country: 'FR', timezone: 'Europe/Paris' },
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`API Claude ${res.status} : ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    content = content.concat(data.content);
    if (data.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
  }

  const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const seen = [...collectSearchUrls(content)];

  // Anti-lien inventé : on ne garde que les URLs réellement vues pendant la recherche.
  return parseIdeas(text)
    .slice(0, 6)
    .map((idea) => {
      const url = typeof idea.url === 'string' && seen.some((u) => sameUrl(u, idea.url)) ? idea.url : null;
      return {
        title: String(idea.title || '').slice(0, 200),
        why: String(idea.why || '').slice(0, 400),
        price: String(idea.price || '').slice(0, 40),
        shop: String(idea.shop || '').slice(0, 80),
        url,
        search_url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(idea.title || '')}`,
      };
    })
    .filter((idea) => idea.title);
}
