import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import JoinForm from './JoinForm.jsx';
import { shareFamily } from '../share.js';

function FamilyRow({ family, current, onChanged }) {
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [name, setName] = useState(family.name);
  const [error, setError] = useState('');

  async function share() {
    if ((await shareFamily(family)) !== 'copied') return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function act(action) {
    setError('');
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <li className={`family${current ? ' family-current' : ''}`}>
      {renaming ? (
        <form
          className="family-rename"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api.renameFamily(family.id, name)).then(() => setRenaming(false));
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            autoFocus
            aria-label="Nom de la famille"
          />
          <button className="button button-small">OK</button>
          <button type="button" className="button button-small button-quiet" onClick={() => setRenaming(false)}>
            Annuler
          </button>
        </form>
      ) : (
        <div className="family-head">
          <p className="family-name">
            {family.name}
            {current && <span className="badge badge-group">Affichée</span>}
          </p>
          <p className="muted small">
            {family.member_count} membre{family.member_count > 1 ? 's' : ''}
          </p>
        </div>
      )}
      <div className="family-code">
        <span className="muted small">Code</span>
        <strong className="num">{family.code}</strong>
        <button type="button" className="button button-small button-go" onClick={share}>
          <Icon name={copied ? 'check' : 'link'} size={16} />
          {copied ? 'Copié' : 'Partager'}
        </button>
      </div>
      <div className="family-actions">
        <button type="button" className="button button-small button-quiet" onClick={() => setRenaming(true)}>
          <Icon name="pencil" size={16} />
          Renommer
        </button>
        <button type="button" className="button button-small button-leave" onClick={() => setLeaving(true)}>
          Quitter
        </button>
      </div>
      {leaving && (
        <div className="confirm-group" role="group" aria-label="Confirmer le départ">
          <p>
            <strong>Quitter « {family.name} » ?</strong> Tu ne verras plus ses membres.
          </p>
          <button
            type="button"
            className="button button-small button-danger"
            onClick={() => act(() => api.leaveFamily(family.id))}
          >
            Oui, quitter
          </button>
          <button type="button" className="button button-small button-quiet" onClick={() => setLeaving(false)}>
            Non, rester
          </button>
        </div>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// « Mes familles » dans le profil : codes à partager, renommer, quitter, en rejoindre ou en créer une autre.
export default function FamiliesPanel({ me, onChanged }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="tile section">
      <h2 className="section-title">Mes familles</h2>
      <ul className="families">
        {me.families.map((f) => (
          <FamilyRow key={f.id} family={f} current={f.id === me.family?.id} onChanged={onChanged} />
        ))}
      </ul>
      {adding ? (
        <JoinForm
          onJoined={(family) => {
            setAdding(false);
            onChanged(family);
          }}
        />
      ) : (
        <button className="add-button" onClick={() => setAdding(true)}>
          <Icon name="plus" size={20} />
          Rejoindre ou créer une famille
        </button>
      )}
    </section>
  );
}
