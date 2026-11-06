import { json, fail, readJson, clean } from '../../../server/http.js';
import { newFamilyCode } from '../../../server/family.js';

export async function onRequestGet({ data }) {
  return json({ families: data.families });
}

// Créer sa famille : on en devient le premier membre, et on reçoit le code à partager.
export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const name = clean(body?.name, 60);
  if (!name) return fail(400, 'Donne un nom à ta famille.');
  if (data.families.length >= 10) return fail(400, 'Tu fais déjà partie de 10 familles.');

  // Un code déjà pris est très improbable, mais on réessaie au cas où.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newFamilyCode();
    const family = await env.DB.prepare(
      'INSERT INTO families (name, code, created_by) VALUES (?1, ?2, ?3) ON CONFLICT(code) DO NOTHING RETURNING id, name, code',
    )
      .bind(name, code, data.me.id)
      .first();
    if (!family) continue;
    await env.DB.prepare('INSERT INTO memberships (family_id, user_id) VALUES (?1, ?2)').bind(family.id, data.me.id).run();
    return json({ family }, 201);
  }
  return fail(500, 'Impossible de créer la famille, réessaie.');
}
