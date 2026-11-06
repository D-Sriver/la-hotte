import { notifyUser, pushConfigured } from './push.js';

/**
 * Prévient des membres de la famille sur leur téléphone quand il se passe quelque chose autour d'un cadeau
 * (message dans la discussion secrète, cagnotte lancée ou rejointe).
 * Règle d'or : jamais la personne gâtée. Seulement les membres de la famille affichée qui ont gardé
 * ce type de notification (Profil → Notifications). L'envoi part après la réponse (waitUntil) : il ne ralentit jamais l'action.
 */
// kind : 'messages' (discussions) ou 'groups' (cagnottes), selon ce que chacun a choisi de recevoir.
const KIND_COLUMN = { messages: 'notify_messages', groups: 'notify_groups' };

export async function recipients(db, { userIds, familyId, ownerId, senderId, kind }) {
  const column = KIND_COLUMN[kind];
  if (!column) throw new Error(`Type de notification inconnu : ${kind}`);
  const ids = [...new Set(userIds)].filter((id) => id && id !== ownerId && id !== senderId);
  if (!ids.length) return [];
  const { results } = await db.prepare(
    `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id AND m.family_id = ?1
     WHERE u.${column} = 1 AND u.id IN (SELECT value FROM json_each(?2))`,
  ).bind(familyId, JSON.stringify(ids)).all();
  return results.map((r) => r.id);
}

export function notifyLater(context, userIds, message) {
  const { env } = context;
  if (!userIds.length || !pushConfigured(env)) return;
  const work = Promise.all(userIds.map((id) => notifyUser(env, id, message).catch((err) => console.warn('notification', err.message))));
  if (context.waitUntil) context.waitUntil(work);
}

// Tous les membres de la famille, pour annoncer une nouvelle cagnotte.
export async function familyMembers(db, familyId) {
  const { results } = await db.prepare('SELECT user_id FROM memberships WHERE family_id = ?1').bind(familyId).all();
  return results.map((r) => r.user_id);
}

// Ceux qui offrent ce cadeau, et ceux qui ont déjà écrit dans sa discussion (dans cette famille).
export async function giftCircle(db, wish, familyId) {
  const { results } = await db.prepare(
    `SELECT user_id FROM contributions WHERE wish_id = ?1
     UNION SELECT user_id FROM wish_messages WHERE wish_id = ?1 AND family_id = ?2`,
  ).bind(wish.id, familyId).all();
  return [wish.reserved_by, ...results.map((r) => r.user_id)];
}

export const ownerName = async (db, wish) =>
  (await db.prepare('SELECT name FROM users WHERE id = ?1').bind(wish.owner_id).first())?.name || 'quelqu’un';
