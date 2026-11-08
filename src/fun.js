const CONFETTI_COLORS = ['#e5383b', '#f6b93b', '#17845d', '#f49ac1', '#172040'];

// Petite explosion de confettis autour d'un élément (bouton « Je réserve »…).
export function burst(element) {
  if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let i = 0; i < 26; i++) {
    const bit = document.createElement('span');
    bit.className = 'confetti';
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 70;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    bit.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * distance - 30}px`);
    bit.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    document.body.appendChild(bit);
    setTimeout(() => bit.remove(), 900);
  }
}

export function daysUntilChristmas(now = new Date()) {
  const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
  const christmas = new Date(year, 11, 25);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((christmas - today) / 86400000);
}

export function christmasLine(days) {
  if (days === 0) return 'C’est aujourd’hui. Trop tard pour réfléchir.';
  if (days === 1) return 'C’est demain. Respire.';
  if (days <= 7) return 'Le Père Noël commence à transpirer.';
  if (days <= 30) return 'Les lutins sont en heures sup’.';
  return 'Largement le temps… c’est ce qu’on dit chaque année.';
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Chaque membre de la famille garde la même couleur partout (tuile, page, transition).
export const TONES = ['red', 'night', 'gold', 'green', 'pink'];
export const toneOf = (id) => TONES[id % TONES.length];

export const GREETINGS = ['Salut', 'Coucou', 'Hey'];

// ---------- Occasions : Noël ou anniversaire, selon ce qui approche ----------

// Dans combien de jours tombe un anniversaire (« MM-JJ », ou date complète « AAAA-MM-JJ »).
export function daysUntilBirthday(date, now = new Date()) {
  if (!date) return null;
  const [month, day] = date.slice(-5).split('-').map(Number);
  if (!month || !day) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

/**
 * La prochaine occasion à fêter parmi des personnes ({ name, birthday, isMe }) :
 * la plus proche, anniversaire ou Noël (Noël l'emporte en cas d'égalité).
 */
export function nextOccasion(people = [], now = new Date()) {
  const christmas = { kind: 'christmas', days: daysUntilChristmas(now) };
  const birthdays = people
    .map((p) => ({ kind: 'birthday', days: daysUntilBirthday(p.birthday, now), name: p.name, isMe: !!p.isMe }))
    .filter((o) => o.days !== null && o.days < christmas.days)
    .sort((a, b) => a.days - b.days);
  return birthdays[0] || christmas;
}

// L'occasion d'une seule personne : son anniversaire s'il passe avant Noël (même en saison), sinon Noël.
export function occasionFor(person, now = new Date()) {
  const christmas = { kind: 'christmas', days: daysUntilChristmas(now) };
  const days = daysUntilBirthday(person?.birthday, now);
  return days !== null && days < christmas.days
    ? { kind: 'birthday', days, name: person.name, isMe: !!person.is_me }
    : christmas;
}

// « de Bruno », « d’Alice », « d’Hugo » : l'élision devant une voyelle ou un h.
export const deName = (name) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`);

export function birthdayLine(days, isMe) {
  if (days === 0) return isMe ? 'Joyeux anniversaire.' : 'C’est aujourd’hui. Il est encore temps.';
  if (days === 1) return 'C’est demain. Respire.';
  if (days <= 7) return isMe ? 'Ta liste est prête ?' : 'Il est temps de réserver quelque chose.';
  return isMe ? 'Pense à remplir ta liste.' : 'Largement le temps… c’est ce qu’on dit à chaque fois.';
}

export const greetingsFor = (occasion) => (occasion.kind === 'christmas' ? ['Ho ho ho', ...GREETINGS] : GREETINGS);
