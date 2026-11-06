// Recadrage d'une photo : "x,y,zoom" (point visé en %, zoom de 1 à 3). null = image entière.

export function parseFrame(text) {
  const parts = String(text || '').split(',').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0], y: parts[1], zoom: parts[2] };
}

export const formatFrame = (frame) => (frame ? `${frame.x.toFixed(1)},${frame.y.toFixed(1)},${frame.zoom.toFixed(2)}` : '');

// Style de l'<img> : recadrée (cover, centrée sur le point visé, zoomée vers lui) ou entière (contain).
export function frameStyle(frame) {
  if (!frame) return undefined;
  const position = `${frame.x}% ${frame.y}%`;
  return { objectFit: 'cover', objectPosition: position, transform: `scale(${frame.zoom})`, transformOrigin: position };
}
