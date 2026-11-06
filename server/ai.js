// Idées cadeaux via Workers AI (gratuit dans le quota journalier de Cloudflare).
// Pas de navigation web : le modèle propose des produits connus, et chaque idée
// a un lien « Chercher en ligne » pour vérifier prix et disponibilité.

const SYSTEM = `Tu es la personne de la famille qui a toujours LA bonne idée de cadeau.
Ton but : des idées auxquelles l'acheteur n'aurait pas pensé seul, mais qui tombent juste.

Méthode :
- Pars des goûts précis de la personne et de sa liste d'envies : elles disent son style, son niveau
  (débutant ou passionné) et les prix qu'elle trouve normaux. Creuse un goût plutôt que de rester en surface
  (pour « aime le café », pas « un paquet de café » mais un moulin manuel, un abonnement de torréfacteur, etc.).
- Varie les types : des objets précis, au moins une expérience ou activité (atelier, place, sortie, cours),
  et au moins un petit plaisir qui se consomme ou se partage.
- Respecte le budget. Évite ce qu'elle possède déjà, ce qu'elle n'aime pas, ce qui est sur sa liste
  et les cadeaux déjà reçus.
- Interdit sauf lien évident avec un goût précis : bougie, mug, coffret générique, carte cadeau,
  « box surprise », gadget, plaid, livre sans titre.

Exactitude :
- Ne cite une marque ou un modèle que si tu es sûr qu'il existe et se vend en France.
  Sinon, décris l'objet précisément sans inventer de nom (« un moulin à café manuel à meules en céramique »).
- Le prix est une estimation honnête en euros (≈ 35 €).

Écris en français, simplement, sans formules publicitaires.
Réponds UNIQUEMENT avec un tableau JSON de 5 idées, sans texte avant ni après :
[{"title": "nom précis", "why": "une phrase concrète qui relie l'idée à un goût précis de la personne", "price": "≈ 35 €", "where": "type de boutique en France", "search": "requête courte en français pour le trouver en ligne"}]`;

const OCCASIONS = { christmas: 'pour Noël', birthday: 'pour son anniversaire' };

const wishLine = (w) => [w.title, w.price && `(${w.price})`, w.favorite && '— coup de cœur', w.note && `— ${w.note}`]
  .filter(Boolean).join(' ').slice(0, 200);

function buildPrompt({ person, wishes, received, budget, note, occasion }) {
  const lines = [
    `Propose 5 idées de cadeaux pour ${person.name}${OCCASIONS[occasion] ? ` ${OCCASIONS[occasion]}` : ''}.`,
    `Ce qu'il/elle aime : ${person.likes || 'non précisé'}`,
    `À éviter : ${person.dislikes || 'rien de précisé'}`,
    `Possède déjà : ${person.owns || 'non précisé'}`,
    `Tailles : ${person.sizes || 'non précisé'}`,
    `Budget : ${budget || person.budget_hint || 'libre, raisonnable'}`,
  ];
  if (wishes.length) lines.push(`Sa liste d'envies (ne pas reproposer, mais s'en inspirer) :\n${wishes.map((w) => `- ${wishLine(w)}`).join('\n')}`);
  if (received.length) lines.push(`Cadeaux déjà reçus (ne pas reproposer) : ${received.join(' ; ')}`);
  if (note) lines.push(`Précision de la personne qui offre : ${note}`);
  return lines.join('\n');
}

// Les modèles de Workers AI ne répondent pas tous sous la même forme.
function extractText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  if (result?.response && typeof result.response === 'object') return JSON.stringify(result.response);
  const message = result?.choices?.[0]?.message;
  if (message?.content) return message.content;
  const output = result?.output?.find?.((o) => o.type === 'message')?.content?.find?.((c) => c.text);
  return output?.text || '';
}

function parseIdeas(text) {
  const raw = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '').trim();
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
  const result = await env.AI.run(env.AI_MODEL || '@cf/openai/gpt-oss-120b', {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPrompt(input) },
    ],
    // Large : les modèles qui réfléchissent avant de répondre comptent leur réflexion dedans.
    max_tokens: 4000,
    temperature: 0.8,
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
