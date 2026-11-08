// Pour quelle occasion on offre : Noël, anniversaire, ou autre. Visible seulement de ceux qui offrent.
export const OCCASIONS = ['christmas', 'birthday', 'other'];

const DAY = 86_400_000;
const daysUntil = (month, day, now) => {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let next = Date.UTC(now.getUTCFullYear(), month - 1, day);
  if (next < today) next = Date.UTC(now.getUTCFullYear() + 1, month - 1, day);
  return Math.round((next - today) / DAY);
};

// Par défaut : la fête la plus proche de la personne gâtée, son anniversaire ou Noël.
export function defaultOccasion(birthday, now = new Date()) {
  const [, month, day] = String(birthday || '')
    .split('-')
    .map(Number);
  if (!month || !day) return 'christmas';
  return daysUntil(month, day, now) < daysUntil(12, 25, now) ? 'birthday' : 'christmas';
}

export async function occasionFor(db, ownerId, now = new Date()) {
  const owner = await db.prepare('SELECT birthday FROM users WHERE id = ?1').bind(ownerId).first();
  return defaultOccasion(owner?.birthday, now);
}
