import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

const FIELDS = [
  {
    key: 'likes',
    label: 'Ce que tu aimes',
    hint: 'Passions, séries, couleurs, marques… plus c’est précis, mieux c’est.',
    rows: 4,
  },
  {
    key: 'owns',
    label: 'Ce que tu as déjà',
    hint: 'Pour éviter les doublons : collections, matériel, tomes possédés…',
    rows: 3,
  },
  { key: 'dislikes', label: 'À éviter', hint: 'Ce qui ne te ferait pas plaisir.', rows: 2 },
  { key: 'sizes', label: 'Tailles', hint: 'Vêtements, pointure, bague…', rows: 1 },
];

const fromProfile = (initial) => ({
  name: initial.name || '',
  likes: initial.likes || '',
  owns: initial.owns || '',
  dislikes: initial.dislikes || '',
  sizes: initial.sizes || '',
  budget_hint: initial.budget_hint || '',
  birthday: initial.birthday || '',
});

// quick : premier passage, juste le prénom et les goûts ; le reste se complète plus tard dans Profil.
// Une rubrique remplie prend le ruban doré : on voit d'un coup d'œil ce que la famille sait déjà.
const filledClass = (value) => `field${String(value || '').trim() ? ' field-filled' : ''}`;
const FieldLabel = ({ children }) => (
  <span className="field-label">
    {children}
    <span className="field-done" aria-hidden="true">
      <Icon name="check" size={14} />
    </span>
  </span>
);

export default function ProfileForm({ initial, submitLabel = 'Enregistrer', quick = false, onSaved }) {
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
      <label className={filledClass(form.name)}>
        <FieldLabel>Prénom</FieldLabel>
        <input value={form.name} onChange={set('name')} required maxLength={60} autoComplete="given-name" />
      </label>
      {(quick ? FIELDS.slice(0, 1) : FIELDS).map((f) => (
        <label className={filledClass(form[f.key])} key={f.key}>
          <FieldLabel>{f.label}</FieldLabel>
          <span className="field-hint">{f.hint}</span>
          {f.rows > 1 ? (
            <textarea rows={f.rows} value={form[f.key]} onChange={set(f.key)} />
          ) : (
            <input value={form[f.key]} onChange={set(f.key)} />
          )}
        </label>
      ))}
      {quick ? (
        <p className="field-hint">Tailles, budget, anniversaire… tu pourras compléter quand tu veux dans « Profil ».</p>
      ) : (
        <>
          <label className={filledClass(form.budget_hint)}>
            <FieldLabel>Budget idéal</FieldLabel>
            <span className="field-hint">Une indication pour la famille, ex. « 20 à 50 € ».</span>
            <input value={form.budget_hint} onChange={set('budget_hint')} maxLength={60} />
          </label>
          <label className={filledClass(form.birthday)}>
            <FieldLabel>Anniversaire</FieldLabel>
            <span className="field-hint">Pour que la famille y pense. Seuls le jour et le mois sont montrés.</span>
            <input
              type="date"
              value={form.birthday}
              onChange={set('birthday')}
              max={new Date().toISOString().slice(0, 10)}
            />
          </label>
        </>
      )}
      <div className={`form-actions${dirty ? ' form-actions-sticky' : ''}`}>
        <button className="button" disabled={status.saving}>
          {status.saving ? 'Enregistrement…' : submitLabel}
        </button>
        {dirty && !status.saving && !quick && <span className="muted small">Modifications non enregistrées</span>}
        {status.message && (
          <span className="success" role="status">
            {status.message}
          </span>
        )}
        {status.error && (
          <span className="error" role="alert">
            {status.error}
          </span>
        )}
      </div>
    </form>
  );
}
