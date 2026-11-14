// Idées proposées par l'IA, gardées pour les retrouver et pour que l'IA ne se répète pas.
// Même règle de secret que les idées secrètes : la personne ne voit jamais celles cherchées pour elle par les autres.

import { searchUrl } from './ai.js';

const COLUMNS = 'id, title, why, price, shop, search_url, rating, kept, created_at';

// Pour soi : uniquement ses propres recherches. Pour un proche : celles de la famille affichée.
function scope(personId, viewerId, familyId) {
  return personId === viewerId
    ? { where: 'person_id = ?1 AND asked_by = ?1 AND family_id IS NULL', binds: [personId] }
    : { where: 'person_id = ?1 AND family_id = ?2 AND asked_by != ?1', binds: [personId, familyId] };
}

// Les idées gardées avant le changement de recherche pointent encore vers l'onglet Shopping : on les redirige.
const SHOPPING_LINK = 'https://www.google.com/search?tbm=shop&q=';
const shape = (row) => ({
  ...row,
  kept: !!row.kept,
  search_url: row.search_url?.startsWith(SHOPPING_LINK)
    ? searchUrl(decodeURIComponent(row.search_url.slice(SHOPPING_LINK.length)))
    : row.search_url,
});

export async function ideaHistory(db, personId, viewerId, familyId, limit = 40) {
  const { where, binds } = scope(personId, viewerId, familyId);
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM ai_ideas WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${Number(limit)}`)
    .bind(...binds)
    .all();
  return results.map(shape);
}

export async function saveIdea(db, { personId, viewerId, familyId }, idea) {
  const row = await db
    .prepare(
      `INSERT INTO ai_ideas (person_id, asked_by, family_id, title, why, price, shop, search_url)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING ${COLUMNS}`,
    )
    .bind(
      personId,
      viewerId,
      personId === viewerId ? null : familyId,
      idea.title,
      idea.why,
      idea.price,
      idea.shop,
      idea.search_url,
    )
    .first();
  return shape(row);
}

// Une idée que la personne connectée a le droit de voir depuis la famille affichée, sinon null.
export async function visibleIdea(db, ideaId, viewerId, familyId) {
  const idea = await db.prepare('SELECT * FROM ai_ideas WHERE id = ?1').bind(ideaId).first();
  if (!idea) return null;
  if (idea.person_id === viewerId) return idea.asked_by === viewerId && idea.family_id === null ? idea : null;
  if (idea.family_id !== familyId || idea.asked_by === idea.person_id) return null;
  const member = await db
    .prepare('SELECT 1 FROM memberships WHERE family_id = ?1 AND user_id = ?2')
    .bind(familyId, idea.person_id)
    .first();
  return member ? idea : null;
}
