import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

const DISMISSED_KEY = 'la-hotte-install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Invite à installer La Hotte sur l'écran d'accueil du téléphone :
// bouton natif sur Android/Chrome, mode d'emploi sur iPhone (Safari n'a pas de bouton).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return undefined;
    if (isIos() && window.matchMedia('(max-width: 40rem)').matches) {
      setIos(true);
      setVisible(true);
    }
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* stockage indisponible */
    }
  };

  const install = async () => {
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    dismiss();
  };

  if (!visible) return null;
  return (
    <div className="install" role="region" aria-label="Installer l’app">
      <img src="/icon-192.png" alt="" width="40" height="40" />
      <p className="install-text">
        <strong>Installe La Hotte</strong>
        {ios ? (
          <span>
            Touche <Icon name="share" size={14} /> en bas de Safari, puis « Sur l’écran d’accueil ».
          </span>
        ) : (
          <span>Elle s’ouvrira comme une vraie app, depuis ton écran d’accueil.</span>
        )}
      </p>
      {!ios && deferred && (
        <button className="button button-small button-go" onClick={install}>
          <Icon name="download" size={16} />
          Installer
        </button>
      )}
      <button className="icon-button" onClick={dismiss} aria-label="Ne plus afficher">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
