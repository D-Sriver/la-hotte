const TONES = ['berry', 'pine', 'amber', 'plum', 'sky'];

export default function Avatar({ name = '', index = 0, size = 'md' }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`avatar avatar-${size} avatar-${TONES[index % TONES.length]}`} aria-hidden="true">
      {initial}
    </span>
  );
}
