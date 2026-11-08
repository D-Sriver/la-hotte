// En-tête compact des pages : un titre, quelques chiffres clés, et l'action principale à droite.
// Il laisse le vrai contenu (les listes) visible dès l'ouverture.
export default function PageHead({ title, stats = [], subtitle, children, tone = 'gold' }) {
  return (
    // data-zoom-target : la transition depuis le paquet (ou une tuile) vient se poser ici.
    <header className={`tile page-head page-head-${tone}`} data-zoom-target>
      <div className="page-head-main">
        <h1 className="page-head-title">{title}</h1>
        {stats.length > 0 && (
          <p className="page-head-stats">
            {stats.filter(Boolean).map((stat) => (
              <span key={stat}>{stat}</span>
            ))}
          </p>
        )}
        {subtitle && <p className="page-head-sub">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
