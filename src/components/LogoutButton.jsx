import { api } from '../api.js';
import Icon from './Icon.jsx';
import { forgetAll } from '../offline.js';

// Avec Cloudflare Access, la session se ferme sur cette page ; avec la connexion par email, on efface le cookie.
const ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout';

export default function LogoutButton({ email, emailLogin, quiet }) {
  const logout = async (e) => {
    forgetAll(); // les listes gardées pour le hors-connexion ne restent pas sur l'appareil
    if (!emailLogin) return;
    e.preventDefault();
    await api.logout().catch(() => {});
    window.location.reload();
  };
  return (
    <div className={`logout${quiet ? ' logout-quiet' : ''}`}>
      {email && (
        <p className="muted small">
          Connecté avec <strong>{email}</strong>
        </p>
      )}
      <a className="button button-quiet" href={ACCESS_LOGOUT_URL} onClick={logout}>
        <Icon name="logout" size={18} />
        Se déconnecter ou changer de compte
      </a>
    </div>
  );
}
