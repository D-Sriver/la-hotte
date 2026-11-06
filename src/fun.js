const CONFETTI_COLORS = ['#e5383b', '#f6b93b', '#17845d', '#f49ac1', '#172040'];

// Petite explosion de confettis autour d'un élément (bouton « Je réserve »…).
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

export const GREETINGS = ['Ho ho ho', 'Salut', 'Coucou', 'Hey'];
