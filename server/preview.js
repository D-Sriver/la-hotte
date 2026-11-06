import { searchPrice } from './pricesearch.js';

// Lit une page produit pour pré-remplir une envie : titre, prix, image.
// Au mieux de ce que le site veut bien donner (certains, comme Amazon, bloquent souvent les robots).

const PAGE_LIMIT = 1_500_000;
const IMAGE_LIMIT = 4_000_000;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6',
};

async function readLimited(response, limit) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  const bytes = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset);
    bytes.set(part, offset);
    offset += part.length;
  }
  return { bytes, truncated: size >= limit };
}

const decodeEntities = (text) => text
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

function metaContent(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[:]/g, '\\:');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${escaped}["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeEntities(match[1]).trim();
    }
  }
  return '';
}

// Les fiches produit décrivent souvent le produit en JSON-LD (schema.org/Product).
// On fouille tout l'arbre : @graph, listes, ProductGroup et ses variantes, offres imbriquées.
const isProduct = (node) => [].concat(node['@type'] || []).some((t) => /^(Product|ProductGroup|IndividualProduct)$/.test(t));

function findPrice(offers) {
  for (const offer of [].concat(offers || [])) {
    if (!offer || typeof offer !== 'object') continue;
    const direct = offer.price ?? offer.lowPrice;
    if (direct != null && direct !== '') return { amount: String(direct), currency: offer.priceCurrency || '' };
    for (const spec of [].concat(offer.priceSpecification || [])) {
      if (/Strikethrough|ListPrice|MSRP/i.test(spec?.priceType || '')) continue; // ancien prix barré
      if (spec?.price != null) return { amount: String(spec.price), currency: spec.priceCurrency || offer.priceCurrency || '' };
    }
    const nested = findPrice(offer.offers);
    if (nested) return nested;
  }
  return null;
}

const imageOf = (image) => {
  const first = [].concat(image || [])[0];
  return typeof first === 'string' ? first : first?.contentUrl || first?.url || '';
};

function productFromJsonLd(html) {
  const products = [];
  for (const [, raw] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try { parsed = JSON.parse(raw.trim()); } catch { continue; }
    const queue = [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) { queue.push(...node); continue; }
      if (!node || typeof node !== 'object') continue;
      if (isProduct(node)) products.push(node);
      for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item', 'hasVariant']) {
        if (node[key]) queue.push(node[key]);
      }
    }
  }
  // Une page catégorie liste plein de produits : on garde celui qui a un prix, en premier.
  for (const node of products) {
    const price = findPrice(node.offers) || (node.hasVariant ? findPrice([].concat(node.hasVariant).map((v) => v.offers)) : null);
    if (products.length > 3 && !price) continue;
    return {
      title: typeof node.name === 'string' ? node.name : '',
      price: price?.amount || '',
      currency: price?.currency || '',
      image: imageOf(node.image),
    };
  }
  return {};
}

// Microdonnées : <span itemprop="price" content="12.99"> ou <meta itemprop="price" ...>.
function priceFromMicrodata(html) {
  const tag = html.match(/<[^>]+itemprop=["']price["'][^>]*>/i)?.[0];
  if (!tag) return '';
  return tag.match(/content=["']([\d.,\s]+)["']/i)?.[1]?.trim() || '';
}

// Texte visible de la page, pour l'IA en dernier recours.
function visibleText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

// Les boutiques qui bloquent les robots laissent au moins le lien : son « slug » donne souvent le nom.
export function titleFromUrl(pageUrl) {
  let url;
  try { url = new URL(pageUrl); } catch { return ''; }
  const words = url.pathname
    .split('/')
    .map((part) => decodeURIComponent(part).replace(/\.(html?|php|aspx?)$/i, ''))
    .filter((part) => /[a-zà-ÿ]{3,}.*[-_].*[a-zà-ÿ]/i.test(part))
    .sort((a, b) => b.length - a.length)[0];
  if (!words) return '';
  const text = words
    .replace(/[-_]+/g, ' ')
    .replace(/\b[A-Z]?-?[a-z]?\d{5,}\b/gi, '') // références produit
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

const CURRENCY_SIGNS = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };
function formatPrice(amount, currency) {
  const value = Number(String(amount).replace(',', '.'));
  if (!amount || Number.isNaN(value)) return '';
  const text = value.toLocaleString('fr-FR', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${text} ${CURRENCY_SIGNS[currency] || currency || '€'}`.trim();
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function fetchImage(src, pageUrl) {
  let url;
  try { url = new URL(src, pageUrl); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const response = await fetch(url, { headers: { ...HEADERS, referer: pageUrl }, signal: AbortSignal.timeout(6000) });
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.startsWith('image/')) return null;
  const { bytes, truncated } = await readLimited(response, IMAGE_LIMIT);
  if (truncated) return null;
  return `data:${type.split(';')[0]};base64,${toBase64(bytes)}`;
}

async function priceWithAi(env, title, text) {
  if (!env.AI || !text) return '';
  const result = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content: 'On te donne le texte d’une page produit. Réponds UNIQUEMENT avec le prix de vente actuel du produit principal, '
          + 'au format « 24,99 € », ou « ? » si tu ne le trouves pas avec certitude. Ignore les prix barrés, de livraison et des autres produits.',
      },
      { role: 'user', content: `Produit : ${title}\n\nPage :\n${text.slice(0, 6000)}` },
    ],
    max_tokens: 20,
    temperature: 0,
  });
  const answer = String(result?.response ?? '').trim();
  return /\d/.test(answer) && answer.length < 20 ? answer : '';
}

async function readPage(pageUrl, env) {
  const fallback = { title: titleFromUrl(pageUrl), price: '', image: null, blocked: true };
  let response;
  try {
    response = await fetch(pageUrl, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(8000) });
  } catch {
    return fallback;
  }
  // 403, 429, page « Just a moment… » : le site refuse les robots, on fait avec le lien seul.
  if (!response.ok || !(response.headers.get('content-type') || '').includes('html')) return fallback;
  const { bytes } = await readLimited(response, PAGE_LIMIT);
  const html = new TextDecoder().decode(bytes);
  if (/<title>\s*(Just a moment|Access Denied|Attention Required)/i.test(html)) return fallback;

  const product = productFromJsonLd(html);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const title = product.title
    || metaContent(html, ['og:title', 'twitter:title'])
    || (titleTag ? decodeEntities(titleTag).trim() : '');
  let price = formatPrice(
    product.price || metaContent(html, ['product:price:amount', 'og:price:amount', 'price']) || priceFromMicrodata(html),
    product.currency || metaContent(html, ['product:price:currency', 'og:price:currency', 'priceCurrency']),
  );
  const imageSrc = product.image || metaContent(html, ['og:image', 'og:image:url', 'twitter:image']);
  const [image, aiPrice] = await Promise.all([
    imageSrc ? fetchImage(imageSrc, response.url).catch(() => null) : null,
    price ? '' : priceWithAi(env, title, visibleText(html)).catch(() => ''),
  ]);
  price ||= aiPrice;

  return { title: (title || fallback.title).slice(0, 200), price, image, blocked: false };
}

export async function previewLink(pageUrl, env = {}, familyId = null) {
  const found = await readPage(pageUrl, env);
  if (found.price) return found;
  // Pas de prix sur la page (ou page bloquée) : on tente une recherche croisée.
  const match = await searchPrice(env, found.title, pageUrl, familyId).catch(() => null);
  if (!match) return found;
  const image = found.image || (match.thumbnail ? await fetchImage(match.thumbnail, pageUrl).catch(() => null) : null);
  return { ...found, price: match.price, image, price_source: match.source, price_exact: match.exact };
}
