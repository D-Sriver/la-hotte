import { json, fail, readJson, clean } from '../../server/http.js';
import { visibleWishes } from '../../server/wishes.js';
import { usesEmailLogin } from '../../server/auth.js';

const publicProfile = (u) => ({
  id: u.id, email: u.email, name: u.name, likes: u.likes, dislikes: u.dislikes,
  owns: u.owns, sizes: u.sizes, budget_hint: u.budget_hint,
  birthday: u.birthday, notify_email: !!u.notify_email,
});

// AAAA-MM-JJ valide, sinon rien.
const cleanBirthday = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value)) ? value : null;

export async function onRequestGet({ env, data }) {
  const families = data.families;
  const me = { ...publicProfile(data.me), families, family: data.family, email_login: usesEmailLogin(env) };
  if (!data.family) return json({ me, wishes: [] });
  const [wishes, archived] = await Promise.all([
    visibleWishes(env.DB, data.me.id, data.me.id, data.family.id),
    visibleWishes(env.DB, data.me.id, data.me.id, data.family.id, { archived: true }),
  ]);
  return json({ me, wishes, archived });
}

export async function onRequestPut({ request, env, data }) {
  const body = await readJson(request);
  if (!body) return fail(400, 'Données illisibles.');
  const name = clean(body.name, 60);
  if (!name) return fail(400, 'Ajoute ton prénom.');

  const me = await env.DB.prepare(
    `UPDATE users SET name = ?1, likes = ?2, dislikes = ?3, owns = ?4, sizes = ?5,
       budget_hint = ?6, birthday = ?8, notify_email = ?9, updated_at = datetime('now')
     WHERE id = ?7 RETURNING *`,
  )
    .bind(name, clean(body.likes), clean(body.dislikes), clean(body.owns), clean(body.sizes, 300),
      clean(body.budget_hint, 60), data.me.id, cleanBirthday(body.birthday), body.notify_email === false ? 0 : 1)
    .first();
  return json({ me: { ...publicProfile(me), families: data.families, family: data.family } });
}
