import { useState } from 'react';
import { api } from '../api.js';

export default function AddWishForm({ ownerId, forSomeoneElse, onAdded }) {
  const empty = { title: '', url: '', price: '', note: '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.addWish({ ...form, owner_id: ownerId });
      setForm(empty);
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="button button-quiet" onClick={() => setOpen(true)}>
        {forSomeoneElse ? 'Ajouter une idée' : 'Ajouter une envie'}
      </button>
    );
  }

  return (
    <form className="form form-inline" onSubmit={submit}>
      {forSomeoneElse && <p className="field-hint">Cette idée restera secrète : la personne ne la verra pas.</p>}
      <label className="field">
        <span className="field-label">Quoi</span>
        <input value={form.title} onChange={set('title')} required maxLength={200} autoFocus />
      </label>
      <label className="field">
        <span className="field-label">Lien</span>
        <input type="url" inputMode="url" placeholder="https://" value={form.url} onChange={set('url')} />
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
      <div className="form-actions">
        <button className="button" disabled={saving}>{saving ? 'Ajout…' : 'Ajouter'}</button>
        <button type="button" className="button button-quiet" onClick={() => setOpen(false)}>Annuler</button>
        {error && <span className="error" role="alert">{error}</span>}
      </div>
    </form>
  );
}
