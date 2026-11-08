import { fetchPagePrice } from './preview.js';
import { notifyUser, pushConfigured } from './push.js';

// Suivi des prix : chaque matin, on relit la page des cadeaux réservés et pas encore achetés,
// et on prévient celui qui achète (l'organisateur, pour une cagnotte) quand le prix baisse vraiment.
// Seulement les données structurées de la page : ni IA, ni recherche payante.
const PAGES_PER_RUN = 25; // reste loin de la limite de requêtes d'un Worker gratuit
const MIN_DROP_EUROS = 1;
const MIN_DROP_SHARE = 0.05;

const euros = (n) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Une vraie baisse : au moins 1 € et 5 % sous le premier prix relu, et plus basse que la dernière signalée.
export function isNewDrop({ first, price, alerted }) {
  if (!first || !price) return false;
  const drop = first - price;
  if (drop < MIN_DROP_EUROS || drop / first < MIN_DROP_SHARE) return false;
  return alerted === null || alerted === undefined || price < alerted - 0.005;
}

export async function watchPrices(env, { fetchPrice = fetchPagePrice, limit = PAGES_PER_RUN } = {}) {
  const db = env.DB;
  const { results: wishes } = await db
    .prepare(
      `SELECT w.id, w.title, w.url, w.reserved_by, o.name AS owner_name,
              pw.first_price, pw.alerted_at_price, u.notify_prices
       FROM wishes w
       JOIN users o ON o.id = w.owner_id
       JOIN users u ON u.id = w.reserved_by
       LEFT JOIN price_watch pw ON pw.wish_id = w.id
       WHERE w.url IS NOT NULL AND w.reserved_by IS NOT NULL AND w.bought = 0
         AND w.received_at IS NULL AND w.removed_at IS NULL
       ORDER BY pw.checked_at IS NOT NULL, pw.checked_at
       LIMIT ?1`,
    )
    .bind(limit)
    .all();

  const alerts = [];
  for (const wish of wishes) {
    const price = await fetchPrice(wish.url).catch(() => null);
    const first = wish.first_price ?? price;
    const drop = isNewDrop({ first, price, alerted: wish.alerted_at_price });
    await db
      .prepare(
        `INSERT INTO price_watch (wish_id, first_price, last_price, alerted_at_price, checked_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(wish_id) DO UPDATE SET first_price = COALESCE(first_price, excluded.first_price),
           last_price = excluded.last_price, alerted_at_price = excluded.alerted_at_price, checked_at = excluded.checked_at`,
      )
      .bind(wish.id, first, price, drop ? price : (wish.alerted_at_price ?? null))
      .run();
    if (drop && wish.notify_prices) alerts.push({ userId: wish.reserved_by, wish, from: first, to: price });
  }

  if (pushConfigured(env)) {
    for (const { userId, wish, from, to } of alerts) {
      await notifyUser(env, userId, {
        title: 'Prix en baisse',
        body: `« ${wish.title} » pour ${wish.owner_name} : ${euros(to)} au lieu de ${euros(from)}.`,
        url: '/#/cadeaux',
        tag: `prix-${wish.id}`,
      }).catch((err) => console.warn('prix', err.message));
    }
  }
  return { checked: wishes.length, alerts: alerts.length };
}
