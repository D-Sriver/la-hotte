import Icon from './Icon.jsx';

// Cloudflare Access ferme la session ici ; à la visite suivante, il redemande un email.
// C'est aussi comme ça qu'on change de compte.
const LOGOUT_URL = '/cdn-cgi/access/logout';

export default function LogoutButton({ email, quiet }) {
  return (
    <div className={`logout${quiet ? ' logout-quiet' : ''}`}>
      {email && <p className="muted small">Connecté avec <strong>{email}</strong></p>}
      <a className="button button-quiet" href={LOGOUT_URL}>
        <Icon name="logout" size={18} />Se déconnecter ou changer de compte
      </a>
    </div>
  );
}
