import { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from '../motion.js';

// Un nombre qui défile depuis 0 jusqu'à sa valeur, sans re-render React à chaque image.
export default function CountUp({ value, className = 'num' }) {
  const el = useRef(null);
  useGSAP(
    () => {
      if (typeof value !== 'number') return;
      const node = el.current;
      node.textContent = String(value);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const counter = { n: 0 };
        gsap.to(counter, {
          n: value,
          duration: Math.min(1.4, 0.4 + value * 0.02),
          ease: 'power2.out',
          onUpdate: () => {
            node.textContent = String(Math.round(counter.n));
          },
        });
      });
    },
    { dependencies: [value] },
  );
  return (
    <span ref={el} className={className}>
      {typeof value === 'number' ? value : '–'}
    </span>
  );
}
