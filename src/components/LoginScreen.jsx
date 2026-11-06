import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Gift3D from './Gift3D.jsx';
import Icon from './Icon.jsx';

const RESEND_DELAY = 30;

// Six cases pour le code : un seul vrai champ (le collage et le remplissage automatique marchent),
// les cases ne font que l'afficher.
function CodeBoxes({ value, onChange, onComplete }) {
  const input = useRef(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  return (
    <div className="code-boxes" onClick={() => input.current?.focus()}>
      <input
        ref={input}
        className="code-boxes-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Code à 6 chiffres"
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(next);
          if (next.length === 6) onComplete(next);
        }}
        autoFocus
      />
      {digits.map((d, i) => (
        <span
          key={i}
          className={`code-box${i === value.length ? ' code-box-active' : ''}${d.trim() ? ' code-box-filled' : ''}`}
          aria-hidden="true"
        >
          {d.trim()}
        </span>
      ))}
    </div>
  );
}

// Connexion par code envoyé par email : l'adresse, puis le code à 6 chiffres.
export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [status, setStatus] = useState({ sending: false, error: '' });
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return undefined;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function attempt(action) {
    setStatus({ sending: true, error: '' });
    try {
      await action();
      setStatus({ sending: false, error: '' });
    } catch (err) {
      setStatus({ sending: false, error: err.message });
    }
  }

  const sendCode = (e) => {
    e?.preventDefault();
    attempt(async () => {
      await api.loginStart(email);
      setCode('');
      setStep('code');
      setWait(RESEND_DELAY);
    });
  };
  const verify = (value = code) =>
    attempt(async () => {
      try {
        await api.loginVerify(email, value);
      } catch (err) {
        setCode('');
        throw err;
      }
      onLoggedIn();
    });

  return (
    <main className="login">
      <section className="login-hero" aria-hidden="true">
        <p className="login-brand">
          <img src="/icon.svg" alt="" width="34" height="34" />
          La Hotte
        </p>
        <div className="login-gift">
          <Gift3D decorative />
        </div>
        <p className="login-tagline">
          Les listes de cadeaux de la famille.
          <br />
          Sans gâcher les surprises.
        </p>
        <span className="login-snow" />
      </section>

      <section className="login-panel">
        <ol className="login-steps" aria-label="Étapes">
          <li className={step === 'email' ? 'is-current' : 'is-done'}>Ton email</li>
          <li className={step === 'code' ? 'is-current' : ''}>Le code</li>
        </ol>

        {step === 'email' ? (
          <form className="form login-form" onSubmit={sendCode}>
            <h1 className="title">Bienvenue</h1>
            <p className="lead">Pas de mot de passe : entre ton email, on t’envoie un code à 6 chiffres.</p>
            <label className="field">
              <span className="field-label">Ton email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="prenom@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            <button className="button button-accent login-submit" disabled={status.sending}>
              {status.sending ? 'Envoi…' : 'Recevoir mon code'}
            </button>
            {status.error && (
              <p className="error" role="alert">
                {status.error}
              </p>
            )}
            <ul className="login-perks">
              <li>
                <Icon name="lock" size={16} />
                Ta liste reste à toi : tu ne vois jamais ce qu’on te réserve.
              </li>
              <li>
                <Icon name="family" size={16} />
                Une ou plusieurs familles, chacune avec son code.
              </li>
              <li>
                <Icon name="sparkle" size={16} />
                Des idées de cadeaux quand on sèche.
              </li>
            </ul>
          </form>
        ) : (
          <form
            className="form login-form"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <h1 className="title">Regarde tes emails</h1>
            <p className="lead">
              Code envoyé à <strong>{email}</strong>. Pense aussi aux spams.
            </p>
            <CodeBoxes value={code} onChange={setCode} onComplete={verify} />
            <button className="button button-accent login-submit" disabled={status.sending || code.length !== 6}>
              {status.sending ? 'Vérification…' : 'Se connecter'}
            </button>
            {status.error && (
              <p className="error" role="alert">
                {status.error}
              </p>
            )}
            <div className="login-links">
              <button
                type="button"
                className="link-button"
                disabled={wait > 0 || status.sending}
                onClick={() => sendCode()}
              >
                {wait > 0 ? `Renvoyer un code (${wait} s)` : 'Renvoyer un code'}
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setStatus({ sending: false, error: '' });
                }}
              >
                Changer d’email
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
