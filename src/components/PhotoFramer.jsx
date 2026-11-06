import { useRef } from 'react';
import Icon from './Icon.jsx';
import { frameStyle } from '../photoFrame.js';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Recadrer une photo : on la fait glisser pour choisir ce qu'on montre, et on zoome.
// Même format que dans les listes, donc ce qu'on voit ici est ce que verra la famille.
export default function PhotoFramer({ src, frame, onChange, onRemove, children }) {
  const drag = useRef(null);

  const start = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = frame || { x: 50, y: 50, zoom: 1 };
    drag.current = { x: e.clientX, y: e.clientY, base, rect: e.currentTarget.getBoundingClientRect() };
    if (!frame) onChange(base);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    // Glisser l'image vers la droite montre davantage sa gauche : le point visé recule.
    const speed = 100 / d.base.zoom;
    onChange({
      ...d.base,
      x: clamp(d.base.x - ((e.clientX - d.x) / d.rect.width) * speed, 0, 100),
      y: clamp(d.base.y - ((e.clientY - d.y) / d.rect.height) * speed, 0, 100),
    });
  };
  const end = () => { drag.current = null; };

  return (
    <div className="framer">
      <div
        className={`framer-view wish-photo-box${frame ? ' is-framed' : ''}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        role="img"
        aria-label="Aperçu de la photo, glisser pour recadrer"
      >
        <img src={src} alt="" draggable="false" style={frameStyle(frame)} />
        {!frame && <span className="framer-hint"><Icon name="move" size={15} />Glisse pour recadrer</span>}
      </div>
      <div className="framer-tools">
        <label className="framer-zoom">
          <Icon name="search" size={16} />
          <span className="sr-only">Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={frame?.zoom ?? 1}
            onChange={(e) => onChange({ ...(frame || { x: 50, y: 50 }), zoom: Number(e.target.value) })}
          />
        </label>
        {frame && <button type="button" className="button button-small button-quiet" onClick={() => onChange(null)}>Image entière</button>}
        {children}
        <button type="button" className="button button-small button-quiet" onClick={onRemove}>Retirer</button>
      </div>
    </div>
  );
}
