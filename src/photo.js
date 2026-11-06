// Réduit une photo dans le navigateur avant l'envoi : D1 garde des lignes légères.
const MAX_SIDE = 900;
const MAX_LENGTH = 650_000; // limite acceptée par le serveur (cleanPhoto)

export async function shrinkPhoto(file) {
  if (typeof file === 'string') file = await (await fetch(file)).blob(); // data URL venue de l'aperçu d'un lien
  if (!file.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une image.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Impossible de lire cette photo. Essaie en JPEG ou PNG.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_LENGTH) return dataUrl;
  }
  throw new Error('Photo trop lourde, essaie avec une autre.');
}
