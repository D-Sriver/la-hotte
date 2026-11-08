import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PageHead from './PageHead.jsx';
import Skeleton from './Skeleton.jsx';
import { usePageIntro } from '../motion.js';
import { usePageTitle } from '../usePageTitle.js';

const n = (value) => (value ?? 0).toLocaleString('fr-FR');
const when = (sql) =>
  new Date(`${sql.replace(' ', 'T')}Z`).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

// Une jauge de quota : ce qui est utilisé ce mois-ci, sur la limite.
function Quota({ label, used, limit }) {
  const share = limit ? Math.min(1, used / limit) : 0;
  return (
    <div className={`quota${share > 0.8 ? ' quota-high' : ''}`}>
      <p className="quota-label">
        <span>{label}</span>
        <span className="num">
          {n(used)} / {n(limit)}
        </span>
      </p>
      <div className="budget-bar" aria-hidden="true">
        <span style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

const Stat = ({ value, label }) => (
  <div className="admin-stat">
    <span className="admin-stat-num num">{n(value)}</span>
    <span className="admin-stat-label">{label}</span>
  </div>
);

// Tableau de bord de l'administrateur : santé de La Hotte en un coup d'œil, sans aucun secret de cadeau.
export default function AdminPage() {
  usePageTitle('Tableau de bord');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .admin()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const scope = usePageIntro(data !== null || error !== '');

  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!data) return <Skeleton rows={4} />;
  const { people, families, wishes, push, quotas, watch, errors, backup } = data;

  return (
    <div className="bento-page admin-page" ref={scope}>
      <PageHead
        title="Tableau de bord"
        tone="green"
        stats={[
          `${n(people.total)} membres`,
          `${n(people.active_7d)} actifs cette semaine`,
          backup ? `sauvegarde du ${new Date(backup.date).toLocaleDateString('fr-FR')}` : 'pas encore de sauvegarde',
        ]}
      />

      <section className="tile section">
        <h2 className="section-title">La famille</h2>
        <div className="admin-stats">
          <Stat value={people.active_30d} label="actifs ce mois-ci" />
          <Stat value={push.people} label="avec les notifications" />
          <Stat value={wishes.open} label="envies sur les listes" />
          <Stat value={wishes.reserved} label="déjà réservées" />
          <Stat value={wishes.pots} label="cagnottes en cours" />
          <Stat value={wishes.given_this_year} label="offerts cette année" />
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Famille</th>
              <th scope="col">Membres</th>
              <th scope="col">Envies</th>
            </tr>
          </thead>
          <tbody>
            {families.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td className="num">{f.members}</td>
                <td className="num">{f.wishes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tile section">
        <h2 className="section-title">Quotas du mois</h2>
        <Quota
          label="Recherches de prix (SerpApi)"
          used={quotas.price_searches_month}
          limit={quotas.price_searches_limit}
        />
        <p className="muted small admin-note">
          Idées de l’IA : {n(quotas.ideas_today)} aujourd’hui, {n(quotas.ideas_month)} ce mois-ci (au plus{' '}
          {quotas.ideas_per_day_per_person} par personne et par jour).
        </p>
        <p className="muted small admin-note">
          Suivi des prix : {n(watch.tracked)} cadeaux suivis ({n(watch.shopping)} via Google Shopping),{' '}
          {n(watch.untracked)} non suivis, {n(watch.drops)} baisses signalées.
        </p>
      </section>

      <section className="tile section">
        <h2 className="section-title">
          Erreurs<span className="count">{n(errors.week)}</span>
        </h2>
        <p className="muted small">
          {n(errors.day)} ces dernières 24 h, {n(errors.week)} cette semaine. Le détail complet : npm run errors.
        </p>
        {errors.recent.length > 0 && (
          <ul className="admin-errors">
            {errors.recent.map((e) => (
              <li key={`${e.source}-${e.message}`}>
                <span className="admin-error-msg">{e.message}</span>
                <span className="muted small">
                  {e.source === 'server' ? 'serveur' : 'navigateur'} · {e.count} fois · dernière le {when(e.last)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
