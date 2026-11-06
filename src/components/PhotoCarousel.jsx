import { useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { frameStyle, parseFrame } from '../photoFrame.js';

// Les photos d'une envie : on fait défiler du doigt (défilement natif aimanté),
// des points disent où l'on en est, des flèches aident à la souris.
export default function PhotoCarousel({ wishId, photos, title }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const many = photos.length > 1;

  const go = (next) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="carousel" aria-roledescription="carrousel" aria-label={`Photos de « ${title} »`}>
      <div className="carousel-track" ref={track} onScroll={many ? onScroll : undefined}>
        {photos.map((p, i) => {
          const frame = parseFrame(p.frame);
          const url = api.photoUrl(wishId, p.id);
          return (
            <a
              key={p.id}
              className={`carousel-slide wish-photo-box${frame ? ' is-framed' : ''}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Voir la photo ${i + 1} sur ${photos.length} en grand`}
            >
              {/* La première tout de suite : Safari charge mal les images différées dans une zone qui défile. */}
              <img src={url} alt="" loading={i === 0 ? 'eager' : 'lazy'} draggable="false" style={frameStyle(frame)} />
            </a>
          );
        })}
      </div>
      {many && (
        <>
          <button
            type="button"
            className="carousel-arrow carousel-prev"
            aria-label="Photo précédente"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <Icon name="back" size={18} />
          </button>
          <button
            type="button"
            className="carousel-arrow carousel-next"
            aria-label="Photo suivante"
            disabled={index === photos.length - 1}
            onClick={() => go(index + 1)}
          >
            <Icon name="chevron" size={18} />
          </button>
          <div className="carousel-dots" aria-hidden="true">
            {photos.map((p, i) => (
              <span key={p.id} className={i === index ? 'is-active' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
