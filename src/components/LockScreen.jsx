import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { forgetAll } from '../offline.js';

// Appareil partagé : avant de montrer les listes et les réservations, on vérifie qui est là.
export default function LockScreen({ me, onUnlock }) {
  const logout = async (e) => {
    forgetAll();
    if (!me.email_login) return; // Cloudflare Access : le lien ferme la session
    e.preventDefault();
    const { api } = await import('../api.js');
    await api.logout().catch(() => {});
    window.location.reload();
  };
  return (
    <main className="onboarding lock-screen">
      <div className="onboarding-card">
        <Avatar name={me.name} index={me.id} size="lg" />
        <h1 className="title">C’est bien toi, {me.name}&nbsp;?</h1>
        <p className="lead">Cet appareil est partagé : on vérifie avant de montrer tes listes et ce que tu offres.</p>
        <div className="lock-actions">
          <button className="button button-accent" onClick={onUnlock} autoFocus>
            <Icon name="check" size={18} />
            Oui, c’est moi
          </button>
          <a className="button button-quiet" href="/cdn-cgi/access/logout" onClick={logout}>
            <Icon name="logout" size={18} />
            Non, changer de compte
          </a>
        </div>
      </div>
    </main>
  );
}
