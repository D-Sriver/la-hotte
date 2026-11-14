import { useState } from 'react';
import { api } from '../api.js';
import WishForm from './WishForm.jsx';

// « 24 décembre 2025 » à partir de la date enregistrée (AAAA-MM-JJ…).
const dayLabel = (stored) =>
  new Date(`${stored.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// Un cadeau reçu, dans les archives : on le relit, on le corrige, ou on le remet dans sa liste.
export default function ReceivedItem({ wish, onChanged }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="archive-editing">
        <WishForm
          wish={wish}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const details = [
    wish.received_from && `De la part de ${wish.received_from}`,
    wish.received_at && dayLabel(wish.received_at),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="archive-item">
      {wish.photos?.length > 0 && (
        <img className="archive-photo" src={api.photoUrl(wish.id, wish.photos[0].id)} alt="" loading="lazy" />
      )}
      <span className="archive-text">
        <span className="archive-title">{wish.title}</span>
        {details && <span className="muted small">{details}</span>}
        {(wish.price || wish.note) && (
          <span className="muted small archive-note">{[wish.price, wish.note].filter(Boolean).join(' · ')}</span>
        )}
        {wish.url && (
          <a className="small archive-link" href={wish.url} target="_blank" rel="noopener noreferrer">
            Voir le lien
          </a>
        )}
      </span>
      <span className="archive-actions">
        <button className="button button-small button-quiet" onClick={() => setEditing(true)}>
          Modifier
        </button>
        <button
          className="button button-small button-quiet"
          onClick={() => api.setReceived(wish.id, false).then(onChanged)}
        >
          Remettre dans ma liste
        </button>
      </span>
    </li>
  );
}
