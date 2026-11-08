// Agenda des anniversaires : un fichier iCalendar auquel on s'abonne une fois (Google Agenda, Calendrier d'Apple).
// Les anniversaires des membres de toutes ses familles, chaque année. Lien secret, que l'on peut couper.
const TOKEN = /^[A-Za-z0-9_-]{20,40}$/;

const escapeText = (text) =>
  String(text)
    .replace(/[\\;,]/g, (c) => `\\${c}`)
    .replace(/\n/g, '\\n');

// Lignes de 75 octets au plus, comme le veut le format (les suivantes commencent par une espace).
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export async function birthdayCalendar(db, token, now = new Date()) {
  if (!TOKEN.test(token || '')) return null;
  const owner = await db.prepare('SELECT id FROM users WHERE calendar_token = ?1').bind(token).first();
  if (!owner) return null;
  const { results: people } = await db
    .prepare(
      `SELECT DISTINCT u.id, u.name, u.birthday FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE m.family_id IN (SELECT family_id FROM memberships WHERE user_id = ?1)
         AND u.id != ?1 AND u.name IS NOT NULL AND u.birthday IS NOT NULL
       ORDER BY u.name COLLATE NOCASE`,
    )
    .bind(owner.id)
    .all();

  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const year = now.getUTCFullYear();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//La Hotte//Anniversaires//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Anniversaires (La Hotte)',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];
  for (const person of people) {
    const [, month, day] = person.birthday.split('-');
    if (!month || !day) continue;
    const start = `${year - 1}${month}${day}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:anniversaire-${person.id}@la-hotte`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      'RRULE:FREQ=YEARLY',
      `SUMMARY:${escapeText(`Anniversaire de ${person.name}`)}`,
      `DESCRIPTION:${escapeText('Sa liste est dans La Hotte : https://la-hotte.pages.dev/#/')}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
