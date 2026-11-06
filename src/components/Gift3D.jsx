import { useRef } from 'react';
import { zoomInto } from '../zoom.js';

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'];

// Un paquet cadeau en vraie 3D CSS : il tourne seul, s'incline vers le pointeur,
// et sert de porte d'entrée vers « Ma liste » (on plonge dedans).
export default function Gift3D() {
  const scene = useRef(null);

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

  return (
    <a
      href="#/moi"
      className="gift3d"
      ref={scene}
      onPointerMove={tilt}
      onPointerLeave={reset}
      onClick={(e) => {
        e.preventDefault();
        zoomInto(scene.current, '#/moi', { color: '#f6b93b' });
      }}
      aria-label="Ouvrir ma liste"
    >
      <div className="gift3d-tilt">
        <div className="gift3d-spin">
          <div className="gift3d-box">
            {FACES.map((f) => <span key={f} className={`gift3d-face gift3d-${f}`} />)}
          </div>
          <div className="gift3d-lid">
            {FACES.map((f) => <span key={f} className={`gift3d-face gift3d-${f}`} />)}
          </div>
          <div className="gift3d-bow">
            <span />
            <span />
          </div>
        </div>
      </div>
      <div className="gift3d-shadow" />
    </a>
  );
}
