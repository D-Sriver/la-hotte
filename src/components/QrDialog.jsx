import { useEffect, useRef } from 'react';
import { encode } from 'uqr';
import Icon from './Icon.jsx';

// Le QR code de l'invitation, en grand : à Noël, mamie le scanne avec l'appareil photo de son téléphone
// et arrive directement dans la famille, sans recopier de code. Tracé ici, sans service extérieur.
function QrCode({ text }) {
  const { data, size } = encode(text, { border: 2, ecc: 'M' });
  const cells = [];
  data.forEach((row, y) => row.forEach((on, x) => on && cells.push(`M${x},${y}h1v1h-1z`)));
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR code de l’invitation">
      <rect width={size} height={size} fill="#fff" />
      <path d={cells.join('')} fill="#141a2e" shapeRendering="crispEdges" />
    </svg>
  );
}

export default function QrDialog({ family, link, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal?.();
    return () => node?.close?.();
  }, []);
  return (
    <dialog ref={dialog} className="qr-dialog" aria-labelledby="qr-title" onClose={onClose}>
      <h2 id="qr-title" className="section-title">
        Rejoindre « {family.name} »
      </h2>
      <p className="muted small">
        Ouvre l’appareil photo du téléphone et vise le carré : le lien s’affiche, il suffit de le toucher.
      </p>
      <QrCode text={link} />
      <p className="qr-code-text">
        ou le code <strong className="num">{family.code}</strong>
      </p>
      <form method="dialog">
        <button className="button">
          <Icon name="check" size={18} />
          Fermer
        </button>
      </form>
    </dialog>
  );
}
