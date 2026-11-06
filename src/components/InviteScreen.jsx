import { useState } from 'react';
import { api } from '../api.js';
import LogoutButton from './LogoutButton.jsx';

const membersLabel = (n) => (n === 1 ? '1 personne y est déjà' : `${n} personnes y sont déjà`);

// Arrivée par un lien d'invitation : on demande une seule fois avant de rejoindre.
export default function InviteScreen({ me, invite, onJoined, onDeclined }) {
  const [status, setStatus] = useState({ sending: false, error: '' });
  const { family, code } = invite;

  async function join() {
    setStatus({ sending: true, error: '' });
    try {
      const { family: joined } = await api.join(code);
      onJoined(joined);
    } catch (err) {
      setStatus({ sending: false, error: err.message });
    }
  }

  return (
    <main className="onboarding">
      <div className="onboarding-card">
        <img src="/icon.svg" alt="" width="56" height="56" />
        <h1 className="title">Rejoindre « {family.name} » ?</h1>
        <p className="lead">
          Tu as été invité·e sur La Hotte. {membersLabel(family.member_count)} : tu verras leurs listes
          et ils verront la tienne.
        </p>
        <div className="form-actions invite-choice">
          <button className="button button-go" disabled={status.sending} onClick={join}>
            {status.sending ? 'Un instant…' : 'Rejoindre'}
          </button>
          <button className="button button-quiet" disabled={status.sending} onClick={onDeclined}>
            Non merci
          </button>
          {status.error && <span className="error" role="alert">{status.error}</span>}
        </div>
        <LogoutButton email={me.email} emailLogin={me.email_login} quiet />
      </div>
    </main>
  );
}
