import { notifyUser, pushConfigured } from './push.js';
import { emailConfigured, emailLayout, sendEmail } from './email.js';

// Prévenir une personne : en notification sur ses appareils, sinon par email (si l'envoi d'emails est
// configuré). Pour ceux qui n'ont pas activé les notifications, comme des grands-parents sur un vieux téléphone.
// Réservé aux messages rares (baisse de prix, merci) : les discussions restent en notification seulement.
export async function deliver(env, userId, message) {
  let delivered = 0;
  if (pushConfigured(env)) delivered = await notifyUser(env, userId, message).catch(() => 0);
  if (delivered || !emailConfigured(env)) return delivered;
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?1').bind(userId).first();
  if (!user?.email) return 0;
  const link = new URL(message.url || '/', env.APP_URL || 'https://la-hotte.pages.dev').href;
  await sendEmail(env, {
    to: user.email,
    subject: `${message.title} : ${message.body}`.slice(0, 140),
    text: `${message.body}\n\n${link}`,
    html: emailLayout({
      title: message.title,
      paragraphs: [message.body],
      button: { label: 'Ouvrir La Hotte', url: link },
    }),
  });
  return 1;
}
