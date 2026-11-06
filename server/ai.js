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
[{"title": "nom précis", "why": "une phrase concrète qui relie l'idée à un goût précis de la personne", "price": "≈ 35 €", "where": "type de boutique en France, en 2 à 5 mots", "search": "requête courte en français pour le trouver en ligne"}]`;

const OCCASIONS = { christmas: 'pour Noël', birthday: 'pour son anniversaire' };

const wishLine = (w) => [w.title, w.price && `(${w.price})`, w.favorite && '— coup de cœur', w.note && `— ${w.note}`]
  .filter(Boolean).join(' ').slice(0, 200);

function buildPrompt({ person, wishes, received, history = [], budget, note, occasion }) {
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
  // Les idées déjà proposées, avec l'avis de la famille : on s'en inspire sans les répéter.
  const liked = history.filter((i) => i.rating === 1 || i.kept).map((i) => i.title);
  const disliked = history.filter((i) => i.rating === -1 && !i.kept).map((i) => i.title);
  const others = history.filter((i) => !i.rating && !i.kept).map((i) => i.title).slice(0, 20);
  if (liked.length) lines.push(`Idées déjà proposées qui ont plu (même esprit, mais ne pas les répéter) : ${liked.join(' ; ')}`);
  if (disliked.length) lines.push(`Idées déjà proposées jugées à côté (éviter ce genre) : ${disliked.join(' ; ')}`);
  if (others.length) lines.push(`Idées déjà proposées (ne pas reproposer) : ${others.join(' ; ')}`);
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

// Une idée telle que renvoyée au site (on ne fait pas confiance à la forme donnée par le modèle).
export function cleanIdea(idea) {
  if (!idea || typeof idea.title !== 'string' || !idea.title.trim()) return null;
  const query = String(idea.search || idea.title).slice(0, 150);
  return {
    title: idea.title.trim().slice(0, 200),
    why: String(idea.why || '').slice(0, 400),
    price: String(idea.price || '').slice(0, 40),
    shop: String(idea.where || idea.shop || '').slice(0, 120),
    search_url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
  };
}

/**
 * Lit le tableau JSON au fur et à mesure qu'il arrive et rend chaque idée dès que son objet est fermé.
 * push(texte) renvoie les nouvelles idées complètes ; finish() celles qu'on n'a pu lire qu'à la fin.
 */
export function ideaReader() {
  let text = '';
  let pos = -1; // -1 : on n'a pas encore trouvé le « [ » du tableau
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;
  const seen = new Set();

  const take = (raw) => {
    const idea = cleanIdea(raw);
    if (!idea || seen.has(idea.title.toLowerCase())) return null;
    seen.add(idea.title.toLowerCase());
    return idea;
  };

  return {
    push(chunk) {
      text += chunk;
      const found = [];
      if (pos === -1) {
        // Une réflexion écrite dans la réponse (<think>…</think>) peut contenir des crochets : on la saute.
        const thinkStart = text.lastIndexOf('<think>');
        const thinkEnd = text.lastIndexOf('</think>');
        if (thinkStart > thinkEnd) return found;
        const from = thinkEnd === -1 ? 0 : thinkEnd + '</think>'.length;
        const bracket = text.indexOf('[', from);
        if (bracket === -1) return found;
        pos = bracket + 1;
      }
      for (; pos < text.length; pos++) {
        const c = text[pos];
        if (inString) {
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') inString = false;
        } else if (c === '"') inString = true;
        else if (c === '{') {
          if (depth === 0) objectStart = pos;
          depth++;
        } else if (c === '}' && depth > 0) {
          depth--;
          if (depth === 0 && objectStart !== -1) {
            try {
              const idea = take(JSON.parse(text.slice(objectStart, pos + 1)));
              if (idea) found.push(idea);
            } catch { /* objet mal formé : on l'ignore */ }
            objectStart = -1;
          }
        }
      }
      return found;
    },
    finish() {
      return parseIdeas(text).map(take).filter(Boolean);
    },
  };
}

function aiInput(input, stream) {
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPrompt(input) },
    ],
    // Large : les modèles qui réfléchissent avant de répondre comptent leur réflexion dedans.
    max_tokens: 4000,
    temperature: 0.8,
    stream,
  };
}

// Un morceau de réponse en flux (format Workers AI ou format OpenAI). La réflexion n'est pas gardée.
function chunkText(data) {
  if (typeof data?.response === 'string') return data.response;
  const choice = data?.choices?.[0];
  return choice?.delta?.content || choice?.text || '';
}

// Lit le flux d'événements (« data: {...} ») renvoyé par Workers AI quand stream = true.
async function* streamText(stream) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const data = line.startsWith('data:') ? line.slice(5).trim() : '';
      if (!data || data === '[DONE]') continue;
      try {
        yield chunkText(JSON.parse(data));
      } catch { /* ligne incomplète ou autre événement */ }
    }
  }
}

/**
 * Cherche des idées et appelle onIdea(idée) pour chacune, dès qu'elle arrive.
 * Si le modèle ne sait pas répondre en flux, on refait une demande classique.
 */
export async function findIdeas(env, input, onIdea) {
  const model = env.AI_MODEL || '@cf/openai/gpt-oss-120b';
  const reader = ideaReader();
  let count = 0;
  let received = '';
  const emit = async (ideas) => {
    for (const idea of ideas) {
      if (count >= 6) return;
      count++;
      await onIdea(idea);
    }
  };

  const stream = await env.AI.run(model, aiInput(input, true));
  if (stream instanceof ReadableStream) {
    for await (const text of streamText(stream)) {
      received += text;
      await emit(reader.push(text));
    }
    await emit(reader.finish());
  }
  if (count || received.trim()) return count;

  const result = stream instanceof ReadableStream ? await env.AI.run(model, aiInput(input, false)) : stream;
  const fallback = ideaReader();
  await emit(fallback.push(extractText(result)));
  await emit(fallback.finish());
  return count;
}
