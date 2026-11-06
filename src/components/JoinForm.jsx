import { useState } from 'react';
import { api } from '../api.js';

export default function JoinForm({ onJoined }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState({ sending: false, error: '' });

  async function submit(e) {
    e.preventDefault();
    setStatus({ sending: true, error: '' });
    try {
      await api.join(code);
      onJoined();
    } catch (err) {
      setStatus({ sending: false, error: err.message });
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Code familial</span>
        <span className="field-hint">Demande-le à quelqu’un de la famille.</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" />
      </label>
      <div className="form-actions">
        <button className="button" disabled={status.sending}>{status.sending ? 'Vérification…' : 'Entrer'}</button>
        {status.error && <span className="error" role="alert">{status.error}</span>}
      </div>
    </form>
  );
}
