import { sendEmail, emailLayout } from '../server/email.js';
import { priceValue } from '../server/wishes.js';

// Rappels envoyés à J-30, J-14, J-7 et J-3 avant Noël, et à J-7 et J-1 avant un anniversaire.
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
async function remindersFor(db, user, now) {
  const lines = [];
  const keys = [];
  const sent = new Set((await db.prepare('SELECT key FROM reminders_sent WHERE user_id = ?1').bind(user.id).all()).results.map((r) => r.key));

  // Les membres de ses familles (sans doublon s'ils sont dans plusieurs).
  const { results: people } = await db.prepare(
    `SELECT DISTINCT u.id, u.name, u.birthday FROM users u
     JOIN memberships m ON m.user_id = u.id
     WHERE m.family_id IN (SELECT family_id FROM memberships WHERE user_id = ?1) AND u.id != ?1 AND u.name IS NOT NULL`,
  ).bind(user.id).all();

  const xmas = daysUntil(12, 25, now);
  if (XMAS_DAYS.includes(xmas.days)) {
    const key = `xmas-${xmas.year}-${xmas.days}`;
    if (!sent.has(key)) {
      // Personne pour qui je n'ai encore rien réservé (seul ou à plusieurs).
      const { results: covered } = await db.prepare(
        `SELECT DISTINCT w.owner_id FROM wishes w
         WHERE w.received_at IS NULL AND (w.reserved_by = ?1
           OR EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1))`,
      ).bind(user.id).all();
      const coveredIds = new Set(covered.map((r) => r.owner_id));
      const missing = people.filter((p) => !coveredIds.has(p.id)).map((p) => p.name);
      if (missing.length) lines.push(`Noël dans ${xmas.days} jours : rien de prévu pour ${list(missing)}.`);

      // Cagnottes auxquelles je participe et qui ne sont pas bouclées.
      const { results: pots } = await db.prepare(
        `SELECT w.title, w.price, o.name AS owner_name,
                (SELECT COALESCE(SUM(amount), 0) FROM contributions c WHERE c.wish_id = w.id) AS collected
         FROM wishes w JOIN users o ON o.id = w.owner_id
         WHERE w.group_gift = 1 AND w.received_at IS NULL
           AND EXISTS (SELECT 1 FROM contributions c WHERE c.wish_id = w.id AND c.user_id = ?1)`,
      ).bind(user.id).all();
      for (const pot of pots) {
        const target = priceValue(pot.price);
        if (target && pot.collected < target) {
          lines.push(`Cagnotte « ${pot.title} » pour ${pot.owner_name} : ${euros(pot.collected)} sur ${euros(target)}.`);
        }
      }
      if (lines.length) keys.push(key);
    }
  }

  for (const person of people) {
    if (!person.birthday) continue;
    const [, month, day] = person.birthday.split('-').map(Number);
    const birthday = daysUntil(month, day, now);
    const key = `bday-${person.id}-${birthday.year}-${birthday.days}`;
    if (!BIRTHDAY_DAYS.includes(birthday.days) || sent.has(key)) continue;
    lines.push(birthday.days === 1
      ? `C’est l’anniversaire de ${person.name} demain !`
      : `Anniversaire de ${person.name} dans ${birthday.days} jours.`);
    keys.push(key);
  }

  return { lines, keys };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(this.run(env, new Date(event.scheduledTime)));
  },

  async run(env, now) {
    const db = env.DB;
    const { results: users } = await db.prepare(
      `SELECT u.id, u.email, u.name FROM users u
       WHERE u.notify_email = 1 AND u.name IS NOT NULL
         AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)`,
    ).all();

    let sentCount = 0;
    for (const user of users) {
      if (sentCount >= MAX_EMAILS_PER_RUN) break;
      const { lines, keys } = await remindersFor(db, user, now);
      if (!lines.length) continue;
      try {
        await sendEmail(env, {
          to: user.email,
          subject: lines[0],
          text: `${lines.join('\n')}\n\n${env.APP_URL}\n\nPlus de rappels : décoche « Rappels par email » dans ton profil.`,
          html: emailLayout({
            title: `Salut ${user.name} !`,
            paragraphs: [...lines, 'Tu ne veux plus de rappels ? Décoche « Rappels par email » dans ton profil.'],
            button: { label: 'Ouvrir La Hotte', url: env.APP_URL },
          }),
        });
        await db.batch(keys.map((key) => db.prepare('INSERT OR IGNORE INTO reminders_sent (user_id, key) VALUES (?1, ?2)').bind(user.id, key)));
        sentCount++;
      } catch (err) {
        console.error('rappel', user.id, err.message);
      }
    }
    console.log(`Rappels envoyés : ${sentCount}`);
  },
};
