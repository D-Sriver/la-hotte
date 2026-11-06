// Familles : qui voit qui. On ne voit une personne que si l'on partage la famille affichée.

// Sans 0/O ni 1/I/L, pour qu'un code se dicte au téléphone sans erreur.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newFamilyCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// « k7pq m3xa », « K7PQM3XA » ou « K7PQ-M3XA » : tout revient à K7PQ-M3XA.
export function normalizeCode(code) {
  const raw = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export async function myFamilies(db, userId) {
  const { results } = await db.prepare(
    `SELECT f.id, f.name, f.code,
            (SELECT COUNT(*) FROM memberships m2 WHERE m2.family_id = f.id) AS member_count
     FROM families f JOIN memberships m ON m.family_id = f.id
     WHERE m.user_id = ?1
     ORDER BY m.joined_at`,
  )
    .bind(userId)
    .all();
  return results;
}

export async function isMember(db, familyId, userId) {
  if (!familyId) return false;
  return !!(await db.prepare('SELECT 1 FROM memberships WHERE family_id = ?1 AND user_id = ?2')
    .bind(familyId, userId).first());
}
