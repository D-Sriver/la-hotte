export const PROFILE_KEYS = ['likes', 'owns', 'dislikes', 'sizes', 'budget_hint'];

export function profileCompletion(person) {
  const done = PROFILE_KEYS.filter((key) => person[key]?.trim()).length;
  return { done, total: PROFILE_KEYS.length };
}
