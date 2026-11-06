import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { currentSubscription, disablePush, enablePush, isInstalled, isIos, pushSupported } from '../push.js';

// Notifications sur ce téléphone : rappels de Noël, anniversaires et cagnottes.
export default function NotificationsPanel() {
  const [status, setStatus] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });

  useEffect(() => {
    api.pushStatus().then(setStatus).catch(() => setStatus({ configured: false }));
    currentSubscription().then((s) => setSubscribed(!!s)).catch(() => {});
  }, []);

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
        Sur iPhone, installe d’abord La Hotte : touche <Icon name="share" size={14} /> en bas de Safari,
        puis « Sur l’écran d’accueil ». Ouvre-la depuis l’écran d’accueil et reviens ici.
      </p>
    );
  } else if (!pushSupported()) content = <p className="muted small">Ce navigateur ne sait pas recevoir de notifications.</p>;
  else {
    content = (
      <div className="notif-actions">
        {subscribed ? (
          <>
            <button className="button button-small button-go" disabled={busy}
              onClick={() => act(() => api.pushTest(), 'Notification envoyée, regarde ton téléphone !')}>
              <Icon name="bell" size={16} />M’envoyer un test
            </button>
            <button className="button button-small button-leave" disabled={busy}
              onClick={() => act(async () => { await disablePush(); setSubscribed(false); }, 'Notifications coupées sur cet appareil.')}>
              Couper sur cet appareil
            </button>
          </>
        ) : (
          <button className="button button-accent" disabled={busy}
            onClick={() => act(async () => { await enablePush(status.public_key); setSubscribed(true); }, 'C’est activé ! Tu peux m’envoyer un test.')}>
            <Icon name="bell" size={18} />Activer les notifications
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="tile section">
      <h2 className="section-title">Notifications</h2>
      <p className="muted small">Un petit rappel avant Noël et les anniversaires, et quand une cagnotte n’est pas bouclée. Jamais de pub.</p>
      {content}
      {message.text && <p className={message.error ? 'error small' : 'success small'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  );
}
