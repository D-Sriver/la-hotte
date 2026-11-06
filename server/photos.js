import { cleanPhoto, cleanFrame } from './http.js';

export const MAX_PHOTOS = 6;

// Sous-requête : les photos d'une envie, dans l'ordre, sans leur contenu (juste numéro et recadrage).
export const PHOTOS_JSON = `(SELECT json_group_array(json_object('id', p.id, 'frame', p.frame))
  FROM (SELECT id, frame FROM wish_photos WHERE wish_id = w.id ORDER BY position, id) p)`;

export const parsePhotos = (text) => JSON.parse(text || '[]');

// Vérifie une liste de photos avant toute écriture : nombre, et contenu des nouvelles.
export function checkPhotos(items) {
  if (items === undefined) return null;
  if (!Array.isArray(items)) return 'Photos illisibles.';
  if (items.length > MAX_PHOTOS) return `${MAX_PHOTOS} photos au maximum.`;
  if (items.some((item) => !item?.id && !cleanPhoto(item?.data))) return 'Photo trop lourde ou illisible.';
  return null;
}

/**
 * Enregistre la liste complète des photos d'une envie, dans l'ordre (la première est la couverture).
 * Chaque élément : { id } pour garder une photo existante, ou { data } pour en ajouter une ; plus son recadrage.
 * Renvoie un message d'erreur, ou null si tout va bien.
 */
export async function savePhotos(db, wishId, items) {
  if (!Array.isArray(items)) return null;
  if (items.length > MAX_PHOTOS) return `${MAX_PHOTOS} photos au maximum.`;
  const { results } = await db.prepare('SELECT id FROM wish_photos WHERE wish_id = ?1').bind(wishId).all();
  const existing = new Set(results.map((r) => r.id));

  const statements = [];
  const kept = new Set();
  for (const [position, item] of items.entries()) {
    const frame = cleanFrame(item?.frame);
    if (item?.id && existing.has(Number(item.id))) {
      kept.add(Number(item.id));
      statements.push(
        db
          .prepare('UPDATE wish_photos SET position = ?1, frame = ?2 WHERE id = ?3')
          .bind(position, frame, Number(item.id)),
      );
    } else {
      const photo = cleanPhoto(item?.data);
      if (!photo) return 'Photo trop lourde ou illisible.';
      statements.push(
        db
          .prepare('INSERT INTO wish_photos (wish_id, photo, frame, position) VALUES (?1, ?2, ?3, ?4)')
          .bind(wishId, photo, frame, position),
      );
    }
  }
  for (const id of existing) {
    if (!kept.has(id)) statements.push(db.prepare('DELETE FROM wish_photos WHERE id = ?1').bind(id));
  }
  if (statements.length) await db.batch(statements);
  return null;
}
