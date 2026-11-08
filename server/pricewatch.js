import { fetchPagePrice } from './preview.js';
import { deliver } from './deliver.js';
import { searchPrice } from './pricesearch.js';
import { priceValue } from './wishes.js';

// Suivi des prix : chaque matin, on relit la page des cadeaux réservés et pas encore achetés,
// et on prévient celui qui achète (l'organisateur, pour une cagnotte) quand le prix baisse vraiment.
// Les données structurées de la page d'abord (ni IA ni recherche payante), Google Shopping en dernier recours.
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

// Boutique qui bloque la lecture (Amazon, Decathlon…) : une recherche Google Shopping par semaine au plus,
// 2 par matin au plus (environ 60 par mois sur les 200 du quota SerpApi), et seulement si la boutique
// elle-même apparaît dans les résultats : un prix moyen d'autres vendeurs donnerait de fausses baisses.
const SHOPPING_PER_RUN = 2;
const SHOPPING_EVERY_DAYS = 7;

const shoppingPrice = async (env, wish) => {
  const match = await searchPrice(env, wish.title, wish.url, null);
  return match?.exact ? priceValue(match.price) : null;
};

const daysSince = (sqlDate, now) =>
  sqlDate ? (now - Date.parse(`${sqlDate.replace(' ', 'T')}Z`)) / 86_400_000 : Infinity;

export async function watchPrices(
  env,
  { fetchPrice = fetchPagePrice, searchShopping = shoppingPrice, limit = PAGES_PER_RUN, now = new Date() } = {},
) {
  const db = env.DB;
  const { results: wishes } = await db
    .prepare(
      `SELECT w.id, w.title, w.url, w.reserved_by, o.name AS owner_name,
              pw.first_price, pw.last_price, pw.alerted_at_price, pw.source, pw.shopping_checked_at, u.notify_prices
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
  let shoppingLeft = env.SERPAPI_KEY ? SHOPPING_PER_RUN : 0;
  for (const wish of wishes) {
    let price = await fetchPrice(wish.url).catch(() => null);
    let source = price !== null ? 'page' : null;
    let shoppingAt = wish.shopping_checked_at;
    if (price === null) {
      if (shoppingLeft > 0 && daysSince(wish.shopping_checked_at, now) >= SHOPPING_EVERY_DAYS) {
        shoppingLeft--;
        shoppingAt = now.toISOString().slice(0, 19).replace('T', ' ');
        price = await searchShopping(env, wish).catch(() => null);
        if (price !== null) source = 'shopping';
      } else if (wish.source === 'shopping') {
        // Pas de nouvelle recherche cette semaine : on garde le dernier prix trouvé.
        price = wish.last_price;
        source = 'shopping';
      }
    }
    // Deux sources ne se comparent pas : si elle change, on repart de ce prix.
    const sameSource = !wish.source || !source || wish.source === source;
    const first = sameSource ? (wish.first_price ?? price) : price;
    const alerted = sameSource ? (wish.alerted_at_price ?? null) : null;
    const drop = isNewDrop({ first, price, alerted });
    await db
      .prepare(
        `INSERT INTO price_watch (wish_id, first_price, last_price, alerted_at_price, source, shopping_checked_at, checked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(wish_id) DO UPDATE SET first_price = excluded.first_price, last_price = excluded.last_price,
           alerted_at_price = excluded.alerted_at_price, source = COALESCE(excluded.source, source),
           shopping_checked_at = excluded.shopping_checked_at, checked_at = excluded.checked_at`,
      )
      .bind(wish.id, first, price, drop ? price : alerted, source, shoppingAt)
      .run();
    if (drop && wish.notify_prices) alerts.push({ userId: wish.reserved_by, wish, from: first, to: price });
  }

  for (const { userId, wish, from, to } of alerts) {
    await deliver(env, userId, {
      title: 'Prix en baisse',
      body: `« ${wish.title} » pour ${wish.owner_name} : ${euros(to)} au lieu de ${euros(from)}.`,
      url: '/#/cadeaux',
      tag: `prix-${wish.id}`,
    }).catch((err) => console.warn('prix', err.message));
  }
  return { checked: wishes.length, alerts: alerts.length };
}
