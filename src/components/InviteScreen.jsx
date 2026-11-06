import { useState } from 'react';
import { api } from '../api.js';
import LogoutButton from './LogoutButton.jsx';

// « Léa et Tom y sont déjà », ou le nombre si on n'a pas les prénoms.
function membersLabel({ members = [], member_count: count }) {
  if (!members.length) return count === 1 ? '1 personne y est déjà' : `${count} personnes y sont déjà`;
  const others = count - members.length;
  const names = others > 0 ? [...members, `${others} autre${others > 1 ? 's' : ''}`] : members;
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : names[0];
  return `${list} ${count > 1 ? 'y sont' : 'y est'} déjà`;
}

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
        <h1 className="title">Rejoindre «&nbsp;{family.name}&nbsp;»&nbsp;?</h1>
        <p className="lead">
          Les listes de cadeaux de la famille, sans gâcher les surprises. {membersLabel(family)} : tu verras leurs
          listes et ils verront la tienne.
        </p>
        <div className="form-actions invite-choice">
          <button className="button button-go" disabled={status.sending} onClick={join}>
            {status.sending ? 'Un instant…' : 'Rejoindre'}
          </button>
          <button className="button button-quiet" disabled={status.sending} onClick={onDeclined}>
            Non merci
          </button>
          {status.error && (
            <span className="error" role="alert">
              {status.error}
            </span>
          )}
        </div>
        <LogoutButton email={me.email} emailLogin={me.email_login} quiet />
      </div>
    </main>
  );
}
