import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { shrinkPhoto } from '../photo.js';
import PhotoFramer from './PhotoFramer.jsx';
import { formatFrame, parseFrame } from '../photoFrame.js';

const EMPTY = { title: '', url: '', price: '', note: '', favorite: false };
const MAX_PHOTOS = 6;
let nextKey = 0;

/**
 * Formulaire d'une envie, pour l'ajout comme pour la modification.
 * Photos : une liste ordonnée (la première est la couverture) ; une photo déjà enregistrée n'est
 * jamais renvoyée, seulement son numéro et son recadrage.
 */
export default function WishForm({ ownerId, wish, forSomeoneElse, onDone, onCancel }) {
  const editing = !!wish;
  const [form, setForm] = useState(() => (editing
    ? { title: wish.title, url: wish.url || '', price: wish.price || '', note: wish.note || '', favorite: wish.favorite }
    : EMPTY));
  // Chaque photo : { key, id } si déjà enregistrée, ou { key, data } si nouvelle ; plus son recadrage.
  const [photos, setPhotos] = useState(() => (editing ? wish.photos || [] : [])
    .map((p) => ({ key: `saved-${p.id}`, id: p.id, frame: parseFrame(p.frame) })));
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [hint, setHint] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function addPhotos(sources) {
    const room = MAX_PHOTOS - photos.length;
    const added = [];
    for (const source of sources.slice(0, room)) {
      added.push({ key: `new-${nextKey++}`, data: await shrinkPhoto(source), frame: null });
    }
    if (!added.length) return;
    setPhotos((list) => {
      setSelected(list.length);
      return [...list, ...added];
    });
  }

  async function pickPhotos(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setError('');
    if (files.length > MAX_PHOTOS - photos.length) setError(`${MAX_PHOTOS} photos au maximum : les premières ont été gardées.`);
    try {
      await addPhotos(files);
    } catch (err) {
      setError(err.message);
    }
  }

  const setFrame = (frame) => setPhotos((list) => list.map((p, i) => (i === selected ? { ...p, frame } : p)));

  function removePhoto(index) {
    setPhotos((list) => list.filter((_, i) => i !== index));
    setSelected((i) => Math.max(0, Math.min(i, photos.length - 2)));
  }

  // La photo choisie passe en premier : elle devient la couverture.
  function makeCover(index) {
    setPhotos((list) => [list[index], ...list.filter((_, i) => i !== index)]);
    setSelected(0);
  }

  // Ne remplit que les cases encore vides : on n'écrase jamais ce qui a été tapé.
  async function fillFromLink(url = form.url) {
    setReading(true);
    setError('');
    setHint('');
    try {
      const found = await api.preview(url);
      setForm((f) => ({ ...f, title: f.title || found.title || '', price: f.price || found.price || '' }));
      if (found.image && photos.length === 0) await addPhotos([found.image]).catch(() => {});
      const missing = [!found.price && 'le prix', !found.image && 'la photo'].filter(Boolean);
      if (found.price_source) {
        setHint(found.price_exact
          ? `Prix trouvé chez ${found.price_source} par une recherche : vérifie-le avant d’acheter.`
          : `Prix estimé d’après d’autres boutiques (dont ${found.price_source}) : vérifie-le avant d’acheter.`);
      } else if (found.blocked) {
        setHint(`Ce site bloque la lecture automatique : le nom vient du lien, ajoute ${missing.join(' et ')} à la main.`);
      } else if (!found.title && !found.price && !found.image) {
        setHint('Rien trouvé sur cette page, remplis à la main.');
      } else if (missing.length) {
        setHint(`Pas trouvé ${missing.join(' ni ')} sur la page : à compléter à la main.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      photos: photos.map((p) => (p.id ? { id: p.id, frame: formatFrame(p.frame) } : { data: p.data, frame: formatFrame(p.frame) })),
    };
    try {
      if (editing) await api.updateWish(wish.id, payload);
      else await api.addWish({ ...payload, owner_id: ownerId });
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const srcOf = (p) => (p.id ? api.photoUrl(wish.id, p.id) : p.data);
  const current = photos[selected];
  const canRead = /^https?:\/\/\S+\.\S+/.test(form.url);

  return (
    <form className="form card card-pad" onSubmit={submit}>
      {forSomeoneElse && !editing && <p className="notice"><Icon name="lock" size={15} />Chut. Cette idée reste secrète : la personne ne la verra pas.</p>}
      <label className="field">
        <span className="field-label">Quoi</span>
        <input value={form.title} placeholder={forSomeoneElse ? 'ex. un pull bien chaud' : 'ex. un sécateur'} onChange={set('title')} required maxLength={200} autoFocus />
      </label>
      <label className="field">
        <span className="field-label">Lien <span className="muted small">(facultatif)</span></span>
        <div className="input-with-button">
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={form.url}
            onChange={set('url')}
            onPaste={(e) => {
              // Coller un lien suffit : on lit la page tout de suite.
              const pasted = e.clipboardData.getData('text').trim();
              if (/^https?:\/\/\S+\.\S+/.test(pasted) && !reading) setTimeout(() => fillFromLink(pasted), 0);
            }}
          />
          <button type="button" className="button button-quiet button-small" disabled={!canRead || reading} onClick={() => fillFromLink()}>
            <Icon name="sparkle" size={16} />{reading ? 'Lecture…' : 'Remplir'}
          </button>
        </div>
        <span className="field-hint" role="status">
          {reading ? 'Lecture de la page…' : hint || 'Tu as trouvé l’objet sur un site ? Colle le lien : le prix et la photo arrivent tout seuls.'}
        </span>
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Prix</span>
          <input value={form.price} onChange={set('price')} placeholder="≈ 30 €" maxLength={40} />
        </label>
        <label className="field field-grow">
          <span className="field-label">Note</span>
          <input value={form.note} onChange={set('note')} placeholder="Couleur, taille, édition…" maxLength={500} />
        </label>
      </div>
      <div className="field">
        <span className="field-label">Photos{photos.length > 1 && <span className="muted small"> · la première sert de couverture</span>}</span>
        {current && (
          <PhotoFramer key={current.key} src={srcOf(current)} frame={current.frame} onChange={setFrame} onRemove={() => removePhoto(selected)}>
            {selected > 0 && (
              <button type="button" className="button button-small button-quiet" onClick={() => makeCover(selected)}>
                <Icon name="star" size={15} />En couverture
              </button>
            )}
          </PhotoFramer>
        )}
        <div className="photo-strip">
          {photos.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className={`photo-thumb${i === selected ? ' is-selected' : ''}`}
              onClick={() => setSelected(i)}
              aria-label={`Photo ${i + 1}${i === 0 ? ' (couverture)' : ''} : recadrer`}
              aria-pressed={i === selected}
            >
              <img src={srcOf(p)} alt="" />
              {i === 0 && photos.length > 1 && <span className="photo-thumb-cover"><Icon name="star" size={11} /></span>}
            </button>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className={`photo-pick${photos.length ? ' photo-pick-small' : ''}`}>
              <Icon name="camera" size={18} />{photos.length ? <span className="sr-only">Ajouter des photos</span> : 'Ajouter des photos'}
              <input type="file" accept="image/*" multiple onChange={pickPhotos} />
            </label>
          )}
        </div>
      </div>
      {!forSomeoneElse && (
        <label className="check">
          <input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} />
          <Icon name="star" size={18} />Coup de cœur : ce dont je rêve le plus
        </label>
      )}
      <div className="form-actions">
        <button className="button" disabled={saving || reading}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button>
        {error && <span className="error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
