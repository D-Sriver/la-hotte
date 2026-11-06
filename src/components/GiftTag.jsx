const TONES = ['berry', 'sage', 'gold', 'ink'];

// L'élément signature de l'app : chaque personne est une étiquette cadeau, avec sa ficelle.
export default function GiftTag({ name, detail, index = 0, href, large = false }) {
  const className = `tag-wrap tag-${TONES[index % TONES.length]}${large ? ' tag-large' : ''}`;
  const content = (
    <>
      <svg className="tag-string" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
        <path d="M60 20 C42 20 30 6 14 10 C4 13 2 26 10 32" />
      </svg>
      <span className="tag">
        <span className="tag-hole" aria-hidden="true" />
        <span className="tag-name">{name}</span>
        {detail && <span className="tag-detail">{detail}</span>}
      </span>
    </>
  );
  return href ? <a href={href} className={className}>{content}</a> : <div className={className}>{content}</div>;
}
