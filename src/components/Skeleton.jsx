export default function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton" role="status" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-row" />)}
    </div>
  );
}
