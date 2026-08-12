const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let controller = null;

function canRun() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (reduceMotion.matches || connection?.saveData) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  return true;
}

export async function startAmbient(root) {
  if (!root || controller || !canRun()) return;
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js');
    if (!root.isConnected || !canRun()) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    root.appendChild(renderer.domElement);

    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 0.72;
      const radius = 1.5 + (index % 17) * 0.16;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle * 0.67) * radius * 0.55;
      positions[index * 3 + 2] = ((index % 23) - 11) * 0.16;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x65e4ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = 0;
    let lastFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let destroyed = false;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const onPointer = event => {
      pointerX = (event.clientX / Math.max(1, innerWidth) - 0.5) * 0.2;
      pointerY = (event.clientY / Math.max(1, innerHeight) - 0.5) * 0.12;
    };

    const frame = timestamp => {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden || timestamp - lastFrame < 33) return;
      lastFrame = timestamp;
      const time = timestamp * 0.00008;
      points.rotation.z = time;
      points.rotation.x += (pointerY - points.rotation.x) * 0.03;
      points.rotation.y += (pointerX - points.rotation.y) * 0.03;
      renderer.render(scene, camera);
    };

    addEventListener('resize', resize, { passive: true });
    addEventListener('pointermove', onPointer, { passive: true });
    resize();
    raf = requestAnimationFrame(frame);

    controller = {
      stop() {
        destroyed = true;
        cancelAnimationFrame(raf);
        removeEventListener('resize', resize);
        removeEventListener('pointermove', onPointer);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        controller = null;
      }
    };
  } catch (_) {
    controller = null;
  }
}

export function stopAmbient() {
  controller?.stop();
}
