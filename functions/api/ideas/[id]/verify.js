import { json, fail } from '../../../../server/http.js';
import { visibleIdea } from '../../../../server/ideas.js';
import { verifyProduct } from '../../../../server/pricesearch.js';

// « Vérifier en boutique » : l'idée de l'IA existe-t-elle vraiment ? Le résultat est gardé (une seule recherche par idée).
export async function onRequestPost({ env, data, params }) {
  const idea = await visibleIdea(env.DB, Number(params.id), data.me.id, data.family?.id ?? null);
  if (!idea) return fail(404, 'Idée introuvable.');
  if (idea.verified !== null) return json(summary(idea));

  // La requête de l'IA est dans le lien de recherche (« … acheter ») ; à défaut, le titre.
  const asked = idea.search_url && new URL(idea.search_url).searchParams.get('q');
  const query = (asked ? asked.replace(/ acheter$/, '') : idea.title).slice(0, 150);

  let result;
  try {
    result = await verifyProduct(env, query, data.family?.id ?? null);
  } catch (err) {
    console.error(err);
    return fail(502, 'La vérification a échoué. Réessaie dans un instant.');
  }
  if (result.status === 'unavailable') return fail(503, 'La vérification en boutique n’est pas activée sur ce site.');
  if (result.status === 'limit')
    return fail(429, 'Le plafond mensuel de vérifications est atteint. Utilise « Chercher en ligne ».');

  const found = result.status === 'found';
  await env.DB.prepare(
    'UPDATE ai_ideas SET verified = ?1, found_price = ?2, found_shop = ?3, found_url = ?4 WHERE id = ?5',
  )
    .bind(found ? 1 : 0, found ? result.price : null, found ? result.shop : null, found ? result.url : null, idea.id)
    .run();
  return json({
    id: idea.id,
    verified: found ? 1 : 0,
    found_price: found ? result.price : null,
    found_shop: found ? result.shop : null,
    found_url: found ? result.url : null,
  });
}

const summary = (idea) => ({
  id: idea.id,
  verified: idea.verified,
  found_price: idea.found_price,
  found_shop: idea.found_shop,
  found_url: idea.found_url,
});
