import { useState } from 'react';
import { api } from '../api.js';

// Rejoindre une famille avec son code, ou créer la sienne.
export default function JoinForm({ onJoined, startWith = 'join' }) {
  const [mode, setMode] = useState(startWith);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState({ sending: false, error: '' });
  const joining = mode === 'join';

  async function submit(e) {
    e.preventDefault();
    setStatus({ sending: true, error: '' });
    try {
      const { family } = joining ? await api.join(value) : await api.createFamily(value);
      setValue('');
      setStatus({ sending: false, error: '' });
      onJoined(family);
    } catch (err) {
      setStatus({ sending: false, error: err.message });
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="segmented" role="tablist" aria-label="Rejoindre ou créer">
        <button type="button" role="tab" aria-selected={joining} onClick={() => { setMode('join'); setValue(''); }}>J’ai un code</button>
        <button type="button" role="tab" aria-selected={!joining} onClick={() => { setMode('create'); setValue(''); }}>Créer ma famille</button>
      </div>
      {joining ? (
        <label className="field">
          <span className="field-label">Code de la famille</span>
          <span className="field-hint">Demande-le à quelqu’un de la famille, il ressemble à K7PQ-M3XA.</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} required autoComplete="off"
            autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX" className="code-input" />
        </label>
      ) : (
        <label className="field">
          <span className="field-label">Nom de la famille</span>
          <span className="field-hint">Tu recevras un code à partager avec les autres.</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} required maxLength={60} placeholder="Famille Martin" />
        </label>
      )}
      <div className="form-actions">
        <button className="button" disabled={status.sending}>
          {status.sending ? 'Un instant…' : joining ? 'Rejoindre' : 'Créer'}
        </button>
        {status.error && <span className="error" role="alert">{status.error}</span>}
      </div>
    </form>
  );
}
