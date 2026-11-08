import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { disablePush, enablePush, isInstalled, isIos, pushSupported, syncPush } from '../push.js';

// Ce qu'on peut recevoir. Le choix vaut pour tous ses appareils.
const KINDS = [
  { key: 'reminders', label: 'Rappels du matin', hint: 'Noël, anniversaires, listes vides, cagnottes pas bouclées.' },
  { key: 'messages', label: 'Messages', hint: 'Quand quelqu’un écrit dans une discussion secrète où tu offres.' },
  {
    key: 'groups',
    label: 'Cagnottes',
    hint: 'Une nouvelle cagnotte dans la famille, ou quelqu’un qui rejoint la tienne.',
  },
  {
    key: 'prices',
    label: 'Baisses de prix',
    hint: 'Un cadeau que tu as réservé, pas encore acheté, devient moins cher.',
  },
];

function Switch({ checked, label, hint, disabled, onChange }) {
  return (
    <label className="switch-row">
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        <span className="field-hint">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

// Notifications sur cet appareil (téléphone ou ordinateur) : rappels, cagnottes, discussions.
export default function NotificationsPanel({ me, onChanged }) {
  const [status, setStatus] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });

  const [choices, setChoices] = useState(me.notify || { reminders: true, messages: true, groups: true, prices: true });
  const [saving, setSaving] = useState(null);

  // Enregistré tout de suite ; on revient en arrière si le serveur refuse.
  async function toggle(key, value) {
    const previous = choices;
    setChoices({ ...choices, [key]: value });
    setSaving(key);
    try {
      const saved = await api.setNotify({ [key]: value });
      setChoices(saved);
      onChanged(saved);
    } catch (err) {
      setChoices(previous);
      setMessage({ text: err.message, error: true });
    } finally {
      setSaving(null);
    }
  }

  // On remet l'abonnement de cet appareil d'accord avec le serveur à chaque visite.
  useEffect(() => {
    api
      .pushStatus()
      .then((s) => {
        setStatus(s);
        if (s.configured)
          syncPush(s.public_key)
            .then(setSubscribed)
            .catch(() => setSubscribed(false));
      })
      .catch(() => setStatus({ configured: false }));
  }, []);

  // Le test échoue : on réinscrit cet appareil, puis on réessaie une fois.
  async function test() {
    try {
      await api.pushTest();
    } catch {
      await enablePush(status.public_key);
      await api.pushTest();
    }
  }

  async function act(action, success) {
    setBusy(true);
    setMessage({ text: '', error: false });
    try {
      await action();
      setMessage({ text: success, error: false });
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  let content;
  if (!status) content = <p className="muted small">Chargement…</p>;
  else if (!status.configured) content = <p className="muted small">Les notifications arrivent bientôt.</p>;
  else if (isIos() && !isInstalled()) {
    content = (
      <p className="muted small">
        Sur iPhone, installe d’abord La Hotte : touche <Icon name="share" size={14} /> en bas de Safari, puis « Sur
        l’écran d’accueil ». Ouvre-la depuis l’écran d’accueil et reviens ici.
      </p>
    );
  } else if (!pushSupported())
    content = <p className="muted small">Ce navigateur ne sait pas recevoir de notifications.</p>;
  else {
    content = (
      <div className="notif-actions">
        {subscribed ? (
          <>
            <button
              className="button button-small button-go"
              disabled={busy}
              onClick={() => act(test, 'Notification envoyée : elle arrive dans quelques secondes.')}
            >
              <Icon name="bell" size={16} />
              M’envoyer un test
            </button>
            <button
              className="button button-small button-leave"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await disablePush();
                  setSubscribed(false);
                }, 'Notifications coupées sur cet appareil.')
              }
            >
              Couper sur cet appareil
            </button>
          </>
        ) : (
          <button
            className="button button-accent"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await enablePush(status.public_key);
                setSubscribed(true);
              }, 'C’est activé. Tu peux m’envoyer un test.')
            }
          >
            <Icon name="bell" size={18} />
            Activer les notifications
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="tile section">
      <h2 className="section-title">Notifications</h2>
      <p className="muted small">
        Sur ce téléphone ou cet ordinateur : rappels avant Noël et les anniversaires, cagnottes et messages entre ceux
        qui offrent. Jamais de pub.
      </p>
      {content}
      {status?.configured && (
        <div className="switch-list">
          {KINDS.map((kind) => (
            <Switch
              key={kind.key}
              {...kind}
              checked={!!choices[kind.key]}
              disabled={saving === kind.key}
              onChange={(value) => toggle(kind.key, value)}
            />
          ))}
        </div>
      )}
      {message.text && (
        <p className={message.error ? 'error small' : 'success small'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
