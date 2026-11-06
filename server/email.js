// Envoi d'emails via Resend (connexion par code, rappels). Sans RESEND_API_KEY, rien ne part.

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Un email simple aux couleurs de La Hotte : un titre, des paragraphes, un bouton.
export function emailLayout({ title, paragraphs, button }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#141a2e">${escapeHtml(p)}</p>`).join('');
  const cta = button
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#d93236;color:#fff;font-weight:700;text-decoration:none">${escapeHtml(button.label)}</a></p>`
    : '';
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#eceef3;font-family:-apple-system,Segoe UI,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:28px;border-radius:24px;background:#fff">
<p style="margin:0 0 18px;font-weight:800;font-size:18px;color:#e5383b">🎁 La Hotte</p>
<h1 style="margin:0 0 16px;font-size:22px;color:#141a2e">${escapeHtml(title)}</h1>${body}${cta}
</div></body></html>`;
}

export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('Envoi d’emails non configuré (RESEND_API_KEY, EMAIL_FROM).');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
}
