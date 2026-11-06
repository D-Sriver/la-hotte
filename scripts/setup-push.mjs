// Crée les clés des notifications (VAPID) et les range directement dans les secrets Cloudflare,
// pour le site et pour le Worker des rappels. Les clés ne sont jamais affichées.
// Usage : npm run setup:push   (une seule fois ; le relancer change les clés et désabonne tout le monde)
import { spawnSync } from 'node:child_process';

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const secrets = {
  VAPID_PUBLIC_KEY: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
  VAPID_PRIVATE_KEY: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
};

function put(name, value, args) {
  const result = spawnSync('npx', ['wrangler', ...args, name], { input: value, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Échec pour ${name} (${args.join(' ')}) :\n${result.stderr || result.stdout}`);
    process.exit(1);
  }
  console.log(`✓ ${name} enregistré (${args[0] === 'pages' ? 'site' : 'Worker des rappels'})`);
}

for (const [name, value] of Object.entries(secrets)) {
  put(name, value, ['pages', 'secret', 'put', '--project-name', 'la-hotte']);
  put(name, value, ['secret', 'put', '--config', 'reminders/wrangler.toml']);
}
console.log('\nC’est prêt. Redéploie le site (npm run deploy) pour qu’il prenne les clés.');
