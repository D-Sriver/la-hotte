import { Component } from 'react';
import { reportError } from '../errors.js';

// Si un écran plante, on le dit simplement au lieu d'une page blanche, et l'erreur part dans le journal.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    reportError(error, info?.componentStack || '');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="crash-title">Cet écran a eu un souci</p>
        <p className="muted">C’est noté de notre côté. Recharge la page pour continuer.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    );
  }
}
