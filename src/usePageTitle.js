import { useEffect } from 'react';

let firstPage = true;

/**
 * Titre de l'onglet propre à chaque page (« Tom · La Hotte »), et, quand on change de page,
 * le focus va sur le titre principal : un lecteur d'écran annonce la nouvelle page.
 * Pas au tout premier affichage, pour ne pas voler le focus à l'arrivée.
 */
export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · La Hotte`;
    if (firstPage) {
      firstPage = false;
      return;
    }
    // Les pages qui chargent leurs données affichent leur titre un peu après : on l'attend (3 s au plus).
    const focusHeading = () => {
      const heading = document.querySelector('main h1');
      if (!heading) return false;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focusHeading()) return undefined;
    const main = document.querySelector('main');
    if (!main) return undefined;
    const observer = new MutationObserver(() => focusHeading() && observer.disconnect());
    observer.observe(main, { childList: true, subtree: true });
    const timer = setTimeout(() => observer.disconnect(), 3000);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [title]);
}
