import { json, fail, readJson } from '../../../server/http.js';
import { usesEmailLogin } from '../../../server/auth.js';
import { newLoginCode, hashCode } from '../../../server/session.js';
import { sendEmail, emailLayout } from '../../../server/email.js';

const cleanEmail = (value) => {
  const email = String(value || '')
    .trim()
    .toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(email) ? email : null;
};

// Étape 1 : on envoie un code à 6 chiffres à cette adresse (valable 10 minutes).
export async function onRequestPost({ request, env }) {
  if (!usesEmailLogin(env)) return fail(404, 'Connexion par email désactivée.');
  const email = cleanEmail((await readJson(request))?.email);
  if (!email) return fail(400, 'Adresse email invalide.');

  // Pas plus de 3 codes par adresse et par quart d'heure.
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM login_codes WHERE email = ?1 AND created_at > datetime('now', '-15 minutes')",
  )
    .bind(email)
    .first();
  if (n >= 3) return fail(429, 'Trop de codes demandés. Attends quelques minutes.');

  const code = newLoginCode();
  await env.DB.prepare(
    "INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?1, ?2, datetime('now', '+10 minutes'))",
  )
    .bind(email, await hashCode(env, email, code))
    .run();

  try {
    await sendEmail(env, {
      to: email,
      subject: `${code} : ton code La Hotte`,
      text: `Ton code de connexion à La Hotte : ${code}\nIl est valable 10 minutes. Si tu n'as rien demandé, ignore cet email.`,
      html: emailLayout({
        title: `Ton code : ${code}`,
        paragraphs: [
          'Entre ce code sur La Hotte pour te connecter. Il est valable 10 minutes.',
          'Si tu n’as rien demandé, ignore simplement cet email.',
        ],
      }),
    });
  } catch (err) {
    console.error(err);
    return fail(502, 'L’email n’a pas pu partir. Réessaie dans un instant.');
  }
  return json({ ok: true });
}
