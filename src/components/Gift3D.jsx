import { useRef, useState } from 'react';
import { zoomInto } from '../zoom.js';
import { burst } from '../fun.js';

// Une vraie boîte : la base n'a pas de dessus et le couvercle pas de dessous.
// Chaque paroi a sa face extérieure (papier cadeau) et sa face intérieure (carton, plus sombre).
const SIDES = ['front', 'back', 'right', 'left'];
const BOX_FACES = [...SIDES, 'bottom'];
const LID_FACES = [...SIDES, 'top'];

function Faces({ names }) {
  return names.flatMap((f) => [
    <span key={f} className={`gift3d-face gift3d-${f}`} />,
    <span key={`in-${f}`} className={`gift3d-face gift3d-inner gift3d-${f}`} />,
  ]);
}

// Un paquet cadeau en vraie 3D CSS : il s'incline vers le pointeur,
// tremble d'impatience au survol, et sert de porte d'entrée vers « Ma liste » :
// au clic, il explose en confettis, puis on plonge dedans.
// decorative : simple décor (écran de connexion), sans clic ni lien.
export default function Gift3D({ decorative = false }) {
  const scene = useRef(null);
  const [opening, setOpening] = useState(false);

  const tilt = (e) => {
    const box = scene.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    box.style.setProperty('--tilt-x', `${-y * 30}deg`);
    box.style.setProperty('--tilt-y', `${x * 40}deg`);
  };
  const reset = () => {
    scene.current?.style.setProperty('--tilt-x', '0deg');
    scene.current?.style.setProperty('--tilt-y', '0deg');
  };

  const open = (e) => {
    e.preventDefault();
    if (opening) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      zoomInto(scene.current, '#/moi', { color: '#f6b93b' });
      return;
    }
    setOpening(true);
    // Deux salves de confettis pour une vraie explosion.
    burst(scene.current);
    setTimeout(() => burst(scene.current), 90);
    // On laisse le paquet exploser avant de plonger dedans.
    setTimeout(() => zoomInto(scene.current, '#/moi', { color: '#f6b93b' }), 300);
  };

  const Tag = decorative ? 'div' : 'a';
  const linkProps = decorative
    ? { 'aria-hidden': true }
    : { href: '#/moi', onClick: open, 'aria-label': 'Ouvrir ma liste' };
  return (
    <Tag
      className={`gift3d${opening ? ' gift3d-opening' : ''}${decorative ? ' gift3d-decorative' : ''}`}
      ref={scene}
      onPointerMove={tilt}
      onPointerLeave={reset}
      {...linkProps}
    >
      <div className="gift3d-float">
        <div className="gift3d-tilt">
          <div className="gift3d-spin">
            <div className="gift3d-box">
              <Faces names={BOX_FACES} />
            </div>
            <div className="gift3d-lid">
              <Faces names={LID_FACES} />
              <div className="gift3d-bow">
                <span className="gift3d-loop" />
                <span className="gift3d-loop" />
                <span className="gift3d-loop" />
                <span className="gift3d-loop" />
                <span className="gift3d-knot" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="gift3d-shadow" />
    </Tag>
  );
}
