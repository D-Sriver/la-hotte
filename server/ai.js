// Idées cadeaux via Workers AI (gratuit dans le quota journalier de Cloudflare).
// Pas de navigation web : le modèle propose des produits connus, et chaque idée
// a un lien « Chercher en ligne » pour vérifier prix et disponibilité.

const SYSTEM = `Tu aides une famille française à trouver des idées de cadeaux.
Propose des produits précis et réels (marque, modèle, édition), faciles à trouver en France.
Respecte le budget. Évite ce que la personne possède déjà, ce qu'elle n'aime pas,
et ce qui est déjà sur sa liste. Varie les idées (pas 5 fois le même type d'objet).
Écris en français.
Réponds UNIQUEMENT avec un tableau JSON, sans texte avant ni après, de cette forme :
[{"title": "Nom précis du produit", "why": "une phrase qui relie l'idée à ses goûts", "price": "≈ 35 €", "where": "type de boutique en France", "search": "requête courte pour le trouver en ligne"}]`;

function buildPrompt({ person, wishes, budget, note }) {
  const lines = [
    `Propose 5 idées de cadeaux pour ${person.name}.`,
    `Ce qu'il/elle aime : ${person.likes || 'non précisé'}`,
    `À éviter : ${person.dislikes || 'rien de précisé'}`,
    `Possède déjà : ${person.owns || 'non précisé'}`,
    `Tailles : ${person.sizes || 'non précisé'}`,
    `Budget : ${budget || person.budget_hint || 'libre, raisonnable'}`,
  ];
  if (wishes.length) lines.push(`Déjà sur sa liste (ne pas reproposer) : ${wishes.map((w) => w.title).join(' ; ')}`);
  if (note) lines.push(`Précision de la personne qui offre : ${note}`);
  return lines.join('\n');
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  if (result?.response && typeof result.response === 'object') return JSON.stringify(result.response);
  return result?.choices?.[0]?.message?.content || '';
}

function parseIdeas(text) {
  const raw = text.replace(/```json|```/g, '').trim();
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

export async function findIdeas(env, input) {
  const result = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPrompt(input) },
    ],
    max_tokens: 1200,
    temperature: 0.7,
  });

  return parseIdeas(extractText(result))
    .slice(0, 6)
    .filter((idea) => idea && typeof idea.title === 'string' && idea.title.trim())
    .map((idea) => {
      const query = String(idea.search || idea.title).slice(0, 150);
      return {
        title: idea.title.trim().slice(0, 200),
        why: String(idea.why || '').slice(0, 400),
        price: String(idea.price || '').slice(0, 40),
        shop: String(idea.where || idea.shop || '').slice(0, 80),
        url: null,
        search_url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
      };
    });
}
