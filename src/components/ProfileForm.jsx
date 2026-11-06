import { useState } from 'react';
import { api } from '../api.js';

const FIELDS = [
  { key: 'likes', label: 'Ce que tu aimes', hint: 'Passions, séries, couleurs, marques… plus c’est précis, mieux c’est.', rows: 4 },
  { key: 'owns', label: 'Ce que tu as déjà', hint: 'Pour éviter les doublons : collections, matériel, tomes possédés…', rows: 3 },
  { key: 'dislikes', label: 'À éviter', hint: 'Ce qui ne te ferait pas plaisir.', rows: 2 },
  { key: 'sizes', label: 'Tailles', hint: 'Vêtements, pointure, bague…', rows: 1 },
];

const fromProfile = (initial) => ({
    name: initial.name || '', likes: initial.likes || '', owns: initial.owns || '',
    dislikes: initial.dislikes || '', sizes: initial.sizes || '', budget_hint: initial.budget_hint || '',
    birthday: initial.birthday || '', notify_email: initial.notify_email !== false,
});

export default function ProfileForm({ initial, submitLabel = 'Enregistrer', onSaved }) {
  const [saved, setSaved] = useState(() => fromProfile(initial));
  const [form, setForm] = useState(saved);
  // Modifié mais pas encore enregistré : le bouton reste visible en bas de l'écran.
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus({ saving: true, message: '', error: '' });
    try {
      const { me } = await api.saveMe(form);
      setSaved(form);
      setStatus({ saving: false, message: 'Profil enregistré.', error: '' });
      setTimeout(() => setStatus((st) => ({ ...st, message: '' })), 2500);
      onSaved(me);
    } catch (err) {
      setStatus({ saving: false, message: '', error: err.message });
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Prénom</span>
        <input value={form.name} onChange={set('name')} required maxLength={60} autoComplete="given-name" />
      </label>
      {FIELDS.map((f) => (
        <label className="field" key={f.key}>
          <span className="field-label">{f.label}</span>
          <span className="field-hint">{f.hint}</span>
          {f.rows > 1
            ? <textarea rows={f.rows} value={form[f.key]} onChange={set(f.key)} />
            : <input value={form[f.key]} onChange={set(f.key)} />}
        </label>
      ))}
      <label className="field">
        <span className="field-label">Budget idéal</span>
        <span className="field-hint">Une indication pour la famille, ex. « 20 à 50 € ».</span>
        <input value={form.budget_hint} onChange={set('budget_hint')} maxLength={60} />
      </label>
      <label className="field">
        <span className="field-label">Anniversaire</span>
        <span className="field-hint">Pour que la famille y pense. Seuls le jour et le mois sont montrés.</span>
        <input type="date" value={form.birthday} onChange={set('birthday')} max={new Date().toISOString().slice(0, 10)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={form.notify_email} onChange={(e) => setForm({ ...form, notify_email: e.target.checked })} />
        Rappels (Noël, anniversaires, cagnottes)
      </label>
      <div className={`form-actions${dirty ? ' form-actions-sticky' : ''}`}>
        <button className="button" disabled={status.saving}>{status.saving ? 'Enregistrement…' : submitLabel}</button>
        {dirty && !status.saving && <span className="muted small">Modifications non enregistrées</span>}
        {status.message && <span className="success" role="status">{status.message}</span>}
        {status.error && <span className="error" role="alert">{status.error}</span>}
      </div>
    </form>
  );
}
