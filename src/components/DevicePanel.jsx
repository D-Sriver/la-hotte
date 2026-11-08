import { useState } from 'react';
import { isSharedDevice, setSharedDevice } from '../sharedDevice.js';
import { forgetAll } from '../offline.js';
import { Switch } from './NotificationsPanel.jsx';

// Réglage de cet appareil : partagé (l'iPad du salon) ou personnel.
export default function DevicePanel() {
  const [shared, setShared] = useState(isSharedDevice);
  return (
    <section className="tile section">
      <h2 className="section-title">Cet appareil</h2>
      <div className="switch-list">
        <Switch
          checked={shared}
          label="Appareil partagé"
          hint="Tablette ou ordinateur de la famille : La Hotte demande qui est là à chaque ouverture et ne garde rien pour le hors-connexion."
          onChange={(on) => {
            setSharedDevice(on);
            if (on) forgetAll();
            setShared(on);
          }}
        />
      </div>
    </section>
  );
}
