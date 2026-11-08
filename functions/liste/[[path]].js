import { sharedList, sharedPhoto } from '../../server/share.js';

// Page publique d'une liste partagée hors de la famille : /liste/<jeton>, et ses photos /liste/<jeton>/photo/<n>.
// Lecture seule, sans script, sans réservations. Hors de l'API : Cloudflare Access doit laisser passer /liste/
// (règle « Bypass », voir README).
const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const escape = (text) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const safeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const STYLE = `
:root{--bg:#eceef3;--tile:#fff;--ink:#141a2e;--soft:#4f566a;--line:#e3e6ee;--red:#d93236;--gold:#a86f0c;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0d1020;--tile:#181c30;--ink:#f2f3f8;--soft:#b9bed0;--line:#272c45;--red:#ff6b6e;--gold:#f6b93b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,'Segoe UI',system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}
header{padding:24px;border-radius:20px;background:var(--tile);box-shadow:inset 0 0 0 1px var(--line)}
h1{margin:0 0 4px;font-size:1.75rem;line-height:1.2;font-weight:700}
.note{margin:0;color:var(--soft);font-size:.9rem}
.ribbon{display:block;width:48px;height:4px;margin-bottom:16px;border-radius:2px;background:var(--gold)}
ul{display:grid;gap:8px;margin:16px 0 0;padding:0;list-style:none}
li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:16px;background:var(--tile);box-shadow:inset 0 0 0 1px var(--line)}
li.no-photo{grid-template-columns:minmax(0,1fr)}
img{display:block;width:64px;height:64px;border-radius:12px;object-fit:cover}
.title{margin:0;font-weight:600;overflow-wrap:anywhere}
.title a{color:inherit}
.meta{margin:2px 0 0;color:var(--soft);font-size:.9rem;overflow-wrap:anywhere}
.price{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.fav{color:var(--red);font-weight:600}
.empty{padding:24px;text-align:center;color:var(--soft)}
footer{margin-top:24px;text-align:center;color:var(--soft);font-size:.85rem}
`;

const page = (title, body) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<meta name="robots" content="noindex,nofollow"><title>${escape(title)}</title><style>${STYLE}</style></head>` +
  `<body><main>${body}<footer>La Hotte, les listes de cadeaux de la famille</footer></main></body></html>`;

function wishItem(token, wish) {
  const url = safeUrl(wish.url);
  const title = url
    ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer nofollow">${escape(wish.title)}</a>`
    : escape(wish.title);
  const meta = [
    wish.favorite ? '<span class="fav">Coup de cœur</span>' : '',
    wish.price ? `<span class="price">${escape(wish.price)}</span>` : '',
    wish.note ? escape(wish.note) : '',
  ].filter(Boolean);
  const photo = wish.photo_id
    ? `<img src="/liste/${escape(token)}/photo/${wish.photo_id}" alt="" loading="lazy" width="64" height="64">`
    : '';
  return (
    `<li${photo ? '' : ' class="no-photo"'}>${photo}<div><p class="title">${title}</p>` +
    `${meta.length ? `<p class="meta">${meta.join(' · ')}</p>` : ''}</div></li>`
  );
}

const notFound = () =>
  new Response(
    page(
      'Liste introuvable',
      '<header><span class="ribbon"></span><h1>Liste introuvable</h1><p class="note">Ce lien n’est plus valable : demande le nouveau à la personne qui te l’a envoyé.</p></header>',
    ),
    { status: 404, headers: HEADERS },
  );

export async function onRequestGet({ env, params }) {
  const [token, kind, id] = [].concat(params.path || []);
  if (kind === 'photo') {
    const row = await sharedPhoto(env.DB, token, Number(id));
    if (!row) return new Response('Introuvable', { status: 404, headers: { 'cache-control': 'no-store' } });
    const bytes = Uint8Array.from(atob(row.photo.slice(row.photo.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=3600', 'x-robots-tag': 'noindex' },
    });
  }
  if (kind) return notFound();

  const list = await sharedList(env.DB, token);
  if (!list) return notFound();
  const name = escape(list.owner.name);
  const items = list.wishes.length
    ? `<ul>${list.wishes.map((w) => wishItem(token, w)).join('')}</ul>`
    : `<p class="empty">${name} n’a encore rien mis sur sa liste.</p>`;
  return new Response(
    page(
      `La liste de ${list.owner.name}`,
      `<header><span class="ribbon"></span><h1>La liste de ${name}</h1>` +
        `<p class="note">Lecture seule. Pour éviter de doubler un cadeau, préviens quelqu’un de sa famille avant d’acheter.</p></header>${items}`,
    ),
    { headers: HEADERS },
  );
}
