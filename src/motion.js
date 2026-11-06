import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const EASE_OUT = 'power3.out';

// Entrée d'une page : les tuiles arrivent l'une après l'autre. Rejouée quand `ready` passe à vrai.
export function usePageIntro(ready = true) {
  const scope = useRef(null);
  useGSAP(() => {
    if (!ready) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      // Pendant une transition « entonnoir », l'en-tête est déjà couvert par le calque :
      // on ne l'anime pas, et les autres tuiles attendent que le calque se soit posé.
      const zooming = document.documentElement.dataset.zooming;
      const tiles = [...scope.current.children].filter((el) => !(zooming && el.matches(zooming)));
      gsap.from(tiles, {
        y: 36,
        scale: 0.96,
        opacity: 0,
        duration: 0.7,
        ease: EASE_OUT,
        stagger: 0.08,
        delay: zooming ? 0.55 : 0,
        clearProps: 'transform,opacity',
      });
    });
  }, { scope, dependencies: [ready] });
  return scope;
}

// Fait apparaître en cascade les enfants d'une liste quand leur nombre change.
// Si la liste grandit (idées qui arrivent une à une), seuls les nouveaux enfants sont animés.
export function useStagger(count) {
  const scope = useRef(null);
  const shown = useRef(0);
  useGSAP(() => {
    const from = count > shown.current ? shown.current : 0;
    shown.current = count;
    if (!count) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.from([...scope.current.children].slice(from), {
        y: 16,
        opacity: 0,
        duration: 0.45,
        ease: EASE_OUT,
        stagger: 0.08,
        clearProps: 'transform,opacity',
      });
    });
  }, { scope, dependencies: [count] });
  return scope;
}

export { gsap, useGSAP };
