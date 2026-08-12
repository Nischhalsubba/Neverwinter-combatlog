const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let gsapPromise = null;

function loadGsap() {
  if (reduceMotion.matches) return Promise.resolve(null);
  if (!gsapPromise) {
    gsapPromise = import('https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm')
      .then(module => module.gsap || module.default || null)
      .catch(() => null);
  }
  return gsapPromise;
}

export function warmMotion() {
  if (reduceMotion.matches) return;
  const idle = window.requestIdleCallback || (callback => setTimeout(callback, 400));
  idle(() => { loadGsap(); });
}

export async function revealView(root) {
  if (!root || reduceMotion.matches) return;
  const gsap = await loadGsap();
  if (!gsap) {
    root.classList.remove('view-enter');
    void root.offsetWidth;
    root.classList.add('view-enter');
    return;
  }
  gsap.killTweensOf(root);
  gsap.fromTo(root, { y: 12, autoAlpha: 0.01 }, {
    y: 0,
    autoAlpha: 1,
    duration: 0.28,
    ease: 'power2.out',
    clearProps: 'transform,opacity,visibility',
    overwrite: 'auto'
  });
}

export async function revealCards(root) {
  if (!root || reduceMotion.matches) return;
  const cards = Array.from(root.querySelectorAll('[data-motion-card]')).slice(0, 10);
  if (!cards.length) return;
  const gsap = await loadGsap();
  if (!gsap) return;
  gsap.fromTo(cards, { y: 10, autoAlpha: 0 }, {
    y: 0,
    autoAlpha: 1,
    duration: 0.24,
    stagger: 0.025,
    ease: 'power2.out',
    clearProps: 'transform,opacity,visibility',
    overwrite: 'auto'
  });
}

export async function pulseDropZone(element) {
  if (!element || reduceMotion.matches) return;
  const gsap = await loadGsap();
  if (!gsap) return;
  gsap.fromTo(element, { scale: 0.992 }, {
    scale: 1,
    duration: 0.22,
    ease: 'power2.out',
    clearProps: 'transform',
    overwrite: 'auto'
  });
}
