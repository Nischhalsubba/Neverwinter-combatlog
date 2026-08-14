const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function isHeavyView(root) {
  if (!root) return true;
  if (root.querySelector('[data-task-loading],.rotation-panel,.raw-hits-panel,.table-wrap.raw')) return true;
  return root.querySelectorAll('tr').length >= 100;
}

function animate(element, keyframes, options) {
  if (!element || reduceMotion.matches || typeof element.animate !== 'function') return null;
  const animation = element.animate(keyframes, options);
  animation.finished.catch(() => {}).finally(() => {
    if (!element.isConnected) return;
    element.style.removeProperty('transform');
    element.style.removeProperty('opacity');
  });
  return animation;
}

export function warmMotion() {
  // Native Web Animations needs no library warm-up or network request.
}

export function revealView(root) {
  if (!root || reduceMotion.matches || isHeavyView(root)) return;
  animate(root, [
    { transform: 'translate3d(0,6px,0)', opacity: .3 },
    { transform: 'translate3d(0,0,0)', opacity: 1 }
  ], { duration: 150, easing: 'cubic-bezier(.2,0,0,1)' });
}

export function revealCards(root) {
  if (!root || reduceMotion.matches || isHeavyView(root)) return;
  const cards = Array.from(root.querySelectorAll('[data-motion-card]')).slice(0, 6);
  cards.forEach((card, index) => animate(card, [
    { transform: 'translate3d(0,4px,0)', opacity: .35 },
    { transform: 'translate3d(0,0,0)', opacity: 1 }
  ], { duration: 120, delay: index * 10, easing: 'cubic-bezier(.2,0,0,1)' }));
}

export function pulseDropZone(element) {
  if (!element || reduceMotion.matches) return;
  animate(element, [
    { transform: 'scale(.995)' },
    { transform: 'scale(1)' }
  ], { duration: 120, easing: 'cubic-bezier(.2,0,0,1)' });
}
