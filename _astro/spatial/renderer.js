import * as T from './engine/three.min.js';

function waitForAssets(ready, signal) {
  if (!signal) return ready;
  let abort;
  const stopped = new Promise((_, reject) => {
    abort = () => reject(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  return Promise.race([ready, stopped]).finally(() => signal.removeEventListener('abort', abort));
}

export async function createView(canvas, name, options) {
  const { low = false, signal, poster = false } = options;
  const home = name === 'home';
  let composition;
  let cameraPosition = [0, 0, 8.6];
  let renderer;
  let gl;
  const dispose = () => {
    composition?.dispose();
    renderer?.dispose();
    if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
  };

  try {
    const attributes = { alpha: true, antialias: !low, powerPreference: 'low-power' };
    gl = canvas.getContext('webgl2', attributes);
    if (!gl) throw new Error('WebGL 2 unavailable');
    if (home) {
      const { buildHomeComposition } = await import('./home.js');
      signal?.throwIfAborted();
      composition = buildHomeComposition(options);
    } else {
      const { buildComposition, cameraPositions } = await import('./geometry.js');
      signal?.throwIfAborted();
      cameraPosition = cameraPositions[name];
      composition = buildComposition(name, options);
    }
    await waitForAssets(composition.ready, signal);
    signal?.throwIfAborted();
    renderer = new T.WebGLRenderer({ canvas, context: gl, ...attributes });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? .85 : home || poster ? 1 : 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = home ? 1.24 : 1.12;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(home ? 32 : 31, 4 / 3, .1, 50);
    camera.position.set(...cameraPosition);
    camera.lookAt(0, 0, 0);
    const key = new T.DirectionalLight(home ? 0xffffff : 0xfff7e8, 2.3);
    key.position.set(-4.5, 5.5, 6);
    const fill = new T.DirectionalLight(0xd6edff, home ? 1.35 : 1.05);
    fill.position.set(4, 1.75, -2);
    const ambient = new T.AmbientLight(0xe9eff4, home ? 1.1 : .7);
    scene.add(composition.pivot, key, fill, ambient);

    let width = 0;
    let height = 0;
    let theme;
    return {
      draw({ w, h, x = 0, y = 0, scroll = 0, engagement = 0, focus = -1, reading = -1,
        work01 = 0, work02 = 0, work03 = 0, mobileY = 0, mobileFade = 1, palette }) {
        if (width !== w || height !== h) {
          width = w;
          height = h;
          renderer.setSize(width, height, false);
          const aspect = width / height;
          camera.aspect = aspect;
          if (!home) {
            camera.fov = aspect < 4 / 3
              ? T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(15.5)) * (4 / 3) / aspect))
              : 31;
          }
          camera.updateProjectionMatrix();
        }
        if (home) {
          if (palette !== theme) {
            theme = palette;
            ambient.color.set(palette.light);
            key.intensity = palette.intensity;
            fill.intensity = palette.intensity * .55;
          }
          composition.update({ scroll, x, y, work01, work02, work03, width, height, palette, mobileY, mobileFade, poster });
        } else {
          composition.pivot.rotation.set(y * .125, x * .155, 0);
          composition.update({ scroll, engagement, focus, reading });
        }
        renderer.render(scene, camera);
      },
      reduceResolution() {
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, .72));
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
