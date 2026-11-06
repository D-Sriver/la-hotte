// Quand une boutique bloque la lecture de sa page, on cherche le produit sur Google Shopping
// (via SerpApi) pour au moins estimer le prix. Plafonné chaque mois pour rester dans le gratuit.

const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// « www.fnac.com » → « fnac », pour reconnaître la boutique dans les résultats (« Fnac.com », « Fnac »).
const shopName = (host) =>
  normalize(
    host
      .replace(/^www\./, '')
      .split('.')
      .slice(0, -1)
      .join(''),
  );

// Plafond global (palier gratuit SerpApi) et plafond par famille (pour partager équitablement).
async function underMonthlyLimit(env, familyId) {
  const limit = Number(env.PRICE_SEARCHES_PER_MONTH) || 200;
  const familyLimit = Number(env.FAMILY_PRICE_SEARCHES_PER_MONTH) || 40;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n, SUM(family_id = ?1) AS family_n
     FROM price_searches WHERE created_at >= datetime('now', 'start of month')`,
  )
    .bind(familyId ?? null)
    .first();
  return row.n < limit && (row.family_n || 0) < familyLimit;
}

const formatEuros = (value) =>
  `${value.toLocaleString('fr-FR', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

// Le prix de la boutique d'origine s'il apparaît, sinon le prix médian des premiers résultats.
export function pickPrice(results, host) {
  const priced = results.filter((r) => typeof r.extracted_price === 'number' && r.extracted_price > 0);
  if (!priced.length) return null;
  const shop = shopName(host);
  const same = shop && priced.find((r) => normalize(r.source).includes(shop));
  if (same)
    return { price: formatEuros(same.extracted_price), source: same.source, exact: true, thumbnail: same.thumbnail };
  const top = priced.slice(0, 5).sort((a, b) => a.extracted_price - b.extracted_price);
  const median = top[Math.floor(top.length / 2)];
  return {
    price: `≈ ${formatEuros(median.extracted_price)}`,
    source: median.source,
    exact: false,
    thumbnail: median.thumbnail,
  };
}

export async function searchPrice(env, title, pageUrl, familyId) {
  if (!env.SERPAPI_KEY || !title || title.length < 4) return null;
  if (!(await underMonthlyLimit(env, familyId))) return null;
  await env.DB.prepare('INSERT INTO price_searches (family_id) VALUES (?1)')
    .bind(familyId ?? null)
    .run();

  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: title,
    gl: 'fr',
    hl: 'fr',
    google_domain: 'google.fr',
    api_key: env.SERPAPI_KEY,
  });
  const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) return null;
  const data = await response.json();
  const results = [...(data.shopping_results || []), ...(data.inline_shopping_results || [])];
  return pickPrice(results, new URL(pageUrl).hostname);
}
