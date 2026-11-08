import { sendEmail, emailLayout } from '../server/email.js';
import { notifyUser, pushConfigured } from '../server/push.js';
import { priceValue } from '../server/wishes.js';
import { backupDatabase } from '../server/backup.js';
import { watchPrices } from '../server/pricewatch.js';
import { unfinishedGifts } from '../server/christmas.js';
import { pruneErrors } from '../server/errors.js';

// Rappels envoyés à J-30, J-14, J-7 et J-3 avant Noël, et à J-7 et J-1 avant un anniversaire :
// en notification sur le téléphone, ou par email si l'envoi d'emails est configuré.
const XMAS_DAYS = [30, 14, 7, 3];
const BIRTHDAY_DAYS = [7, 1];
const MAX_EMAILS_PER_RUN = 300;

const DAY = 86_400_000;

const startOfDay = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

function daysUntil(month, day, now) {
  const today = startOfDay(now);
  let next = Date.UTC(now.getUTCFullYear(), month - 1, day);
  if (next < today) next = Date.UTC(now.getUTCFullYear() + 1, month - 1, day);
  return { days: Math.round((next - today) / DAY), year: new Date(next).getUTCFullYear() };
}

const euros = (n) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : names[0]);

// Ce qu'il faut rappeler à une personne aujourd'hui : des lignes de texte et les clés qui évitent les doublons.
export async function remindersFor(db, user, now) {
  const lines = [];
  const keys = [];
  const sent = new Set(
    (await db.prepare('SELECT key FROM reminders_sent WHERE user_id = ?1').bind(user.id).all()).results.map(
      (r) => r.key,
    ),
  );

  // Les membres de ses familles (sans doublon s'ils sont dans plusieurs).
  const { results: people } = await db
    .prepare(
      `SELECT DISTINCT u.id, u.name, u.birthday FROM users u
     JOIN memberships m ON m.user_id = u.id
     WHERE m.family_id IN (SELECT family_id FROM memberships WHERE user_id = ?1) AND u.id != ?1 AND u.name IS NOT NULL`,
    )
    .bind(user.id)
    .all();

  const xmas = daysUntil(12, 25, now);
  if (XMAS_DAYS.includes(xmas.days)) {
    const key = `xmas-${xmas.year}-${xmas.days}`;
    if (!sent.has(key)) {
      // Ma propre liste est vide : la famille n'a rien pour se guider.
      const own = await db
        .prepare(
          'SELECT COUNT(*) AS n FROM wishes WHERE owner_id = ?1 AND added_by = ?1 AND received_at IS NULL AND removed_at IS NULL',
        )
        .bind(user.id)
        .first();
      if (!own.n)
        lines.push(`Noël dans ${xmas.days} jours et ta liste est vide : ajoute quelques envies pour aider ta famille.`);

      // Pour chaque proche : ce que j’ai prévu, ce que les autres ont prévu (toutes familles, sans dire qui), et ses envies.
      const { results: status } = await db
        .prepare(
          `SELECT u.id,
           EXISTS (SELECT 1 FROM wishes w WHERE w.owner_id = u.id AND w.received_at IS NULL
             AND (w.reserved_by = ?1 OR EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1))) AS by_me,
           EXISTS (SELECT 1 FROM wishes w WHERE w.owner_id = u.id AND w.received_at IS NULL
             AND (w.reserved_by IS NOT NULL OR EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id))) AS by_anyone,
           (SELECT COUNT(*) FROM wishes w WHERE w.owner_id = u.id AND w.added_by = u.id AND w.received_at IS NULL AND w.removed_at IS NULL) AS own_wishes
         FROM users u WHERE u.id IN (SELECT value FROM json_each(?2))`,
        )
        .bind(user.id, JSON.stringify(people.map((p) => p.id)))
        .all();
      const byId = new Map(status.map((s) => [s.id, s]));
      const nobody = [];
      const notMe = [];
      const emptyList = [];
      for (const person of people) {
        const s = byId.get(person.id);
        if (!s || s.by_me) continue;
        (s.by_anyone ? notMe : nobody).push(person.name);
        if (!s.own_wishes) emptyList.push(person.name);
      }
      if (nobody.length)
        lines.push(`Noël dans ${xmas.days} jours : personne n’a encore rien prévu pour ${list(nobody)}.`);
      if (notMe.length) lines.push(`Noël dans ${xmas.days} jours : tu n’as encore rien prévu pour ${list(notMe)}.`);
      if (emptyList.length) {
        lines.push(
          emptyList.length > 1
            ? `Les listes de ${list(emptyList)} sont vides : une idée secrète ou l’IA peuvent t’aider.`
            : `La liste de ${emptyList[0]} est vide : une idée secrète ou l’IA peuvent t’aider.`,
        );
      }

      // Cagnottes auxquelles je participe et qui ne sont pas bouclées.
      const { results: pots } = await db
        .prepare(
          `SELECT w.title, w.price, o.name AS owner_name,
                (SELECT COALESCE(SUM(amount), 0) FROM contributions c WHERE c.wish_id = w.id) AS collected
         FROM wishes w JOIN users o ON o.id = w.owner_id
         WHERE w.group_gift = 1 AND w.received_at IS NULL
           AND EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1)`,
        )
        .bind(user.id)
        .all();
      for (const pot of pots) {
        const target = priceValue(pot.price);
        if (target && pot.collected < target) {
          lines.push(
            `Cagnotte « ${pot.title} » pour ${pot.owner_name} : ${euros(pot.collected)} sur ${euros(target)}.`,
          );
        }
      }
      if (lines.length) keys.push(key);
    }
  }

  // Le 26 décembre : ce qui a été réservé mais pas marqué « Offert ». Marqué, il rejoint le récap de Noël
  // de la personne ; sinon il reste réservé pour la prochaine occasion (anniversaire…).
  if (now.getUTCMonth() === 11 && now.getUTCDate() === 26) {
    const key = `after-xmas-${now.getUTCFullYear()}`;
    const left = sent.has(key) ? { count: 0 } : await unfinishedGifts(db, user.id);
    if (left.count) {
      lines.push(
        left.count > 1
          ? `Noël est passé : marque « Offert » les ${left.count} cadeaux que tu as donnés (Ce que j’offre). Les autres restent réservés pour la prochaine occasion.`
          : 'Noël est passé : si tu as donné ton cadeau réservé, marque-le « Offert » (Ce que j’offre). Sinon, il reste réservé pour la prochaine occasion.',
      );
      keys.push(key);
    }
  }

  for (const person of people) {
    if (!person.birthday) continue;
    const [, month, day] = person.birthday.split('-').map(Number);
    const birthday = daysUntil(month, day, now);
    const key = `bday-${person.id}-${birthday.year}-${birthday.days}`;
    if (!BIRTHDAY_DAYS.includes(birthday.days) || sent.has(key)) continue;
    lines.push(
      birthday.days === 1
        ? `L’anniversaire de ${person.name}, c’est demain.`
        : `Anniversaire de ${person.name} dans ${birthday.days} jours.`,
    );
    keys.push(key);
  }

  return { lines, keys };
}

export default {
  // Trois tâches, chacune à son heure (voir wrangler.toml) : chacune garde ses propres limites de requêtes.
  async scheduled(event, env, ctx) {
    const now = new Date(event.scheduledTime);
    const task =
      event.cron === '0 3 * * *'
        ? this.nightly(env, now)
        : event.cron === '0 7 * * *'
          ? watchPrices(env).then((r) => console.log(`Prix relus : ${r.checked}, baisses : ${r.alerts}`))
          : this.run(env, now);
    ctx.waitUntil(task);
  },

  // La nuit : sauvegarde de la base et ménage du journal d'erreurs.
  async nightly(env, now) {
    const saved = await backupDatabase(env, now);
    if (saved) console.log(`Sauvegarde ${saved.key} : ${saved.rows} lignes, ${saved.bytes} octets`);
    await pruneErrors(env.DB);
  },

  // Les erreurs des dernières 24 h, signalées à l'administrateur (ADMIN_EMAIL), une notification au plus par jour.
  async errorDigest(env) {
    if (!env.ADMIN_EMAIL || !pushConfigured(env)) return;
    const admin = await env.DB.prepare('SELECT id FROM users WHERE email = ?1')
      .bind(env.ADMIN_EMAIL.toLowerCase())
      .first();
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n, COUNT(DISTINCT message) AS kinds FROM error_log WHERE created_at >= datetime('now', '-1 day')",
    ).first();
    if (!admin || !row.n) return;
    await notifyUser(env, admin.id, {
      title: 'La Hotte : erreurs',
      body: `${row.n} erreur${row.n > 1 ? 's' : ''} (${row.kinds} différente${row.kinds > 1 ? 's' : ''}) ces dernières 24 h. Détail : npm run errors.`,
      url: '/#/',
      tag: 'erreurs',
    });
  },

  async run(env, now) {
    const db = env.DB;
    const canEmail = !!(env.RESEND_API_KEY && env.EMAIL_FROM);
    // Les personnes qui veulent des rappels et qu'on peut joindre : notifications, ou email si configuré.
    const { results: users } = await db
      .prepare(
        `SELECT u.id, u.email, u.name,
              EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id) AS has_push
       FROM users u
       WHERE u.notify_email = 1 AND u.name IS NOT NULL
         AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)`,
      )
      .all();

    let sentCount = 0;
    for (const user of users) {
      if (sentCount >= MAX_EMAILS_PER_RUN) break;
      const byPush = user.has_push && pushConfigured(env);
      if (!byPush && !canEmail) continue;
      const { lines, keys } = await remindersFor(db, user, now);
      if (!lines.length) continue;
      try {
        if (byPush) {
          // Une notification par rappel (elles s'empilent sur le téléphone), au plus 3.
          let delivered = 0;
          for (const [i, line] of lines.slice(0, 3).entries()) {
            delivered += await notifyUser(env, user.id, {
              title: 'La Hotte',
              body: line,
              url: '/#/',
              tag: `rappel-${i}`,
            });
          }
          if (!delivered && !canEmail) continue; // plus aucun appareil joignable : on réessaiera demain
          if (delivered) {
            await db.batch(
              keys.map((key) =>
                db.prepare('INSERT OR IGNORE INTO reminders_sent (user_id, key) VALUES (?1, ?2)').bind(user.id, key),
              ),
            );
            sentCount++;
            continue;
          }
        }
        await sendEmail(env, {
          to: user.email,
          subject: lines[0],
          text: `${lines.join('\n')}\n\n${env.APP_URL}\n\nPlus de rappels : décoche « Rappels » dans ton profil.`,
          html: emailLayout({
            title: `Tes rappels, ${user.name}`,
            paragraphs: [...lines, 'Tu ne veux plus de rappels ? Décoche « Rappels » dans ton profil.'],
            button: { label: 'Ouvrir La Hotte', url: env.APP_URL },
          }),
        });
        await db.batch(
          keys.map((key) =>
            db.prepare('INSERT OR IGNORE INTO reminders_sent (user_id, key) VALUES (?1, ?2)').bind(user.id, key),
          ),
        );
        sentCount++;
      } catch (err) {
        console.error('rappel', user.id, err.message);
      }
    }
    console.log(`Rappels envoyés : ${sentCount}`);
    await this.errorDigest(env).catch((err) => console.warn('erreurs', err.message));
    return sentCount;
  },
};
