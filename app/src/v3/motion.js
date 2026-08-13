const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let gsapPromise = null;

function loadGsap() {
  if (reduceMotion.matches) return Promise.resolve(null);
  if (!gsapPromise) gsapPromise = import('https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm').then(module => module.gsap || module.default || null).catch(() => null);
  return gsapPromise;
}

function isHeavyView(root) {
  if (!root) return true;
  if (root.querySelector('[data-task-loading],.rotation-panel,.raw-hits-panel,.table-wrap.raw')) return true;
  return root.querySelectorAll('tr').length >= 100;
}

export function warmMotion() {
  if (reduceMotion.matches) return;
  const idle = window.requestIdleCallback || (callback => setTimeout(callback, 400));
  idle(() => { loadGsap(); });
}

export async function revealView(root) {
  if (!root || reduceMotion.matches || isHeavyView(root)) return;
  const gsap = await loadGsap();
  if (!gsap || !root.isConnected || isHeavyView(root)) return;
  gsap.killTweensOf(root);
  gsap.fromTo(root, { y: 8, autoAlpha: .01 }, { y: 0, autoAlpha: 1, duration: .2, ease: 'power2.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto' });
}

export async function revealCards(root) {
  if (!root || reduceMotion.matches || isHeavyView(root)) return;
  const cards = Array.from(root.querySelectorAll('[data-motion-card]')).slice(0, 8);
  if (!cards.length) return;
  const gsap = await loadGsap();
  if (!gsap) return;
  gsap.fromTo(cards, { y: 6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .18, stagger: .02, ease: 'power2.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto' });
}

export async function pulseDropZone(element) {
  if (!element || reduceMotion.matches) return;
  const gsap = await loadGsap();
  if (!gsap) return;
  gsap.fromTo(element, { scale: .992 }, { scale: 1, duration: .18, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' });
}
