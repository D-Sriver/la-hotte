import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { shrinkPhoto } from '../photo.js';

const EMPTY = { title: '', url: '', price: '', note: '', photo: '', favorite: false };

/**
 * Formulaire d'une envie, pour l'ajout comme pour la modification.
 * En modification, `wish` est l'envie existante ; sa photo actuelle n'est renvoyée que si on la change.
 */
export default function WishForm({ ownerId, wish, forSomeoneElse, onDone, onCancel }) {
  const editing = !!wish;
  const [form, setForm] = useState(() => (editing
    ? { title: wish.title, url: wish.url || '', price: wish.price || '', note: wish.note || '', photo: '', favorite: wish.favorite }
    : EMPTY));
  // En modification : 'keep' tant qu'on ne touche pas à la photo existante.
  const [photoState, setPhotoState] = useState(editing && wish.has_photo ? 'keep' : 'none');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [hint, setHint] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function applyPhoto(source) {
    const photo = await shrinkPhoto(source);
    setForm((f) => ({ ...f, photo }));
    setPhotoState('new');
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      await applyPhoto(file);
    } catch (err) {
      setError(err.message);
    }
  }

  function removePhoto() {
    setForm({ ...form, photo: '' });
    setPhotoState(editing && wish.has_photo ? 'removed' : 'none');
  }

  // Ne remplit que les cases encore vides : on n'écrase jamais ce qui a été tapé.
  async function fillFromLink(url = form.url) {
    setReading(true);
    setError('');
    setHint('');
    try {
      const found = await api.preview(url);
      setForm((f) => ({ ...f, title: f.title || found.title || '', price: f.price || found.price || '' }));
      if (found.image && (photoState === 'none' || photoState === 'removed')) await applyPhoto(found.image).catch(() => {});
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
    const { photo, ...fields } = form;
    const payload = { ...fields };
    if (photoState === 'new') payload.photo = photo;
    if (photoState === 'removed') payload.photo = '';
    try {
      if (editing) await api.updateWish(wish.id, payload);
      else await api.addWish({ ...payload, owner_id: ownerId });
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const photoPreview = photoState === 'new' ? form.photo : photoState === 'keep' ? api.photoUrl(wish.id) : null;
  const canRead = /^https?:\/\/\S+\.\S+/.test(form.url);

  return (
    <form className="form card card-pad" onSubmit={submit}>
      {forSomeoneElse && !editing && <p className="notice"><Icon name="lock" size={15} />Chut. Cette idée reste secrète : la personne ne la verra pas.</p>}
      <label className="field">
        <span className="field-label">Lien</span>
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
            autoFocus={!editing}
          />
          <button type="button" className="button button-quiet button-small" disabled={!canRead || reading} onClick={() => fillFromLink()}>
            <Icon name="sparkle" size={16} />{reading ? 'Lecture…' : 'Remplir'}
          </button>
        </div>
        <span className="field-hint" role="status">
          {reading ? 'Lecture de la page…' : hint || 'Colle le lien : le nom, le prix et la photo arrivent tout seuls (quand le site le permet).'}
        </span>
      </label>
      <label className="field">
        <span className="field-label">Quoi</span>
        <input value={form.title} onChange={set('title')} required maxLength={200} autoFocus={editing} />
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
        <span className="field-label">Photo</span>
        {photoPreview ? (
          <div className="photo-preview">
            <img src={photoPreview} alt="" />
            <button type="button" className="button button-quiet button-small" onClick={removePhoto}>Retirer</button>
          </div>
        ) : (
          <label className="photo-pick">
            <Icon name="camera" size={18} />Ajouter une photo
            <input type="file" accept="image/*" onChange={pickPhoto} />
          </label>
        )}
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
