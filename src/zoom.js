import { gsap, MOTION_OK } from './motion.js';

const html = document.documentElement;

// Attend que la nouvelle page affiche son bloc d'en-tête (les données peuvent mettre un instant).
function waitForTarget(selector, timeout = 1500) {
  return new Promise((resolve) => {
    const start = performance.now();
    const look = () => {
      const target = document.querySelector(selector);
      if (target || performance.now() - start > timeout) resolve(target);
      else requestAnimationFrame(look);
    };
    look();
  });
}

// Transition « entonnoir » : un calque part de l'élément cliqué, remplit l'écran,
// on change de page derrière, puis le calque se pose sur l'en-tête de la nouvelle page.
export function zoomInto(element, href, { color, target: selector = '[data-zoom-target]' } = {}) {
  if (!window.matchMedia(MOTION_OK).matches) {
    window.location.hash = href;
    return;
  }
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const fill = color || style.backgroundColor;
  const layer = document.createElement('div');
  layer.className = 'zoom-layer';
  Object.assign(layer.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: style.borderRadius === '0px' ? '24px' : style.borderRadius,
    background: fill,
  });
  document.body.appendChild(layer);

  const land = async () => {
    html.dataset.zooming = selector;
    window.location.hash = href;
    const target = await waitForTarget(selector);
    gsap.set(element, { clearProps: 'scale' });
    if (!target) {
      gsap.to(layer, { opacity: 0, duration: 0.4, onComplete: () => layer.remove() });
      delete html.dataset.zooming;
      return;
    }
    const to = target.getBoundingClientRect();
    gsap
      .timeline({
        onComplete: () => {
          layer.remove();
          delete html.dataset.zooming;
        },
      })
      .to(layer, {
        left: to.left,
        top: to.top,
        width: to.width,
        height: to.height,
        borderRadius: getComputedStyle(target).borderRadius,
        duration: 0.45,
        ease: 'power3.inOut',
      })
      .to(layer, { opacity: 0, duration: 0.2, ease: 'power1.out' });
  };

  gsap
    .timeline()
    .to(element, { scale: 1.08, duration: 0.18, ease: 'power2.out' })
    .to(
      layer,
      {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        borderRadius: 0,
        duration: 0.45,
        ease: 'power4.inOut',
      },
      '<0.05',
    )
    .add(land);
}

// Entonnoir inverse : depuis la page d'une personne, on revient se poser dans sa tuile de l'accueil.
export function zoomBackHome() {
  const header = document.querySelector('.tile-head[data-person]');
  if (!header) {
    window.location.hash = '#/';
    return;
  }
  zoomInto(header, '#/', { target: `[data-person-tile="${header.dataset.person}"]` });
}
