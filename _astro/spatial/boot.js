import { bindHomeInput } from './home-input.js';

const stage = document.querySelector('[data-spatial]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 760px), (pointer: coarse)');
const compactHome = matchMedia('(max-width: 900px)');

function mount(host) {
  const lifecycle = new AbortController();
  const events = { signal: lifecycle.signal };
  const surface = host.querySelector('.spatial-surface');
  const name = host.dataset.spatial;
  const isHome = name === 'home';
  const targets = [...host.querySelectorAll('[data-spatial-target]')];
  const readingPoints = [...document.querySelectorAll('[data-journey] .event')];
  const options = { variant: Number(host.dataset.variant ?? 0), count: readingPoints.length };
  const state = { x: 0, y: 0, scroll: 0, engagement: 0 };
  if (isHome) Object.assign(state, { work01: 0, work02: 0, work03: 0, mobileY: 0, mobileFade: 1 });
  const input = { ...state };
  const axes = Object.keys(state);
  const connection = navigator.connection;
  const lowCapacity = (navigator.deviceMemory ?? Infinity) <= 2 || (navigator.hardwareConcurrency ?? Infinity) <= 2;
  let canvas;
  let view;
  let loading;
  let visibility;
  let resizing;
  let frame = 0;
  let lastDraw = 0;
  let slowTime = 0;
  let reducedResolution = false;
  let snap = true;
  let inView = false;
  let failed = false;
  let lostContext = false;
  let restoredOnce = false;
  let restoreTimer = 0;
  let focused = -1;

  const home = isHome ? bindHomeInput(host, input, schedule, events) : null;

  function requested() {
    return !reduced.matches && !connection?.saveData && !failed && (isHome || (!compact.matches && !lowCapacity));
  }

  function active() {
    return requested() && !lostContext && inView && !document.hidden && !lifecycle.signal.aborted;
  }

  function stopDrawing() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastDraw = 0;
  }

  function release() {
    stopDrawing();
    clearTimeout(restoreTimer);
    lostContext = false;
    loading?.abort();
    loading = null;
    host.classList.remove('spatial-ready');
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', loseContext);
      canvas.removeEventListener('webglcontextrestored', restoreContext);
      canvas.remove();
    }
    view?.dispose();
    view = null;
    canvas = null;
    snap = true;
  }

  function fallback() {
    failed = true;
    release();
  }

  function loseContext(event) {
    event.preventDefault();
    if (restoredOnce) {
      fallback();
      return;
    }
    lostContext = true;
    stopDrawing();
    host.classList.remove('spatial-ready');
    restoreTimer = setTimeout(fallback, 1800);
  }

  function restoreContext() {
    if (!lostContext) return;
    clearTimeout(restoreTimer);
    lostContext = false;
    restoredOnce = true;
    snap = true;
    reconcile();
  }

  function draw(now) {
    frame = 0;
    if (!view || !active()) return;
    const w = surface.clientWidth;
    const h = surface.clientHeight;
    if (!w || !h) return;
    home?.read();
    const elapsed = now - lastDraw;
    let moving = false;
    for (const axis of axes) {
      const delta = input[axis] - state[axis];
      if (!snap && Math.abs(delta) > .003) {
        const speed = axis === 'scroll' ? 38 : axis.startsWith('work') ? 15 : 24;
        const weight = isHome ? 1 - Math.exp(-Math.min(elapsed || 16, 40) * speed / 1000) : .17;
        state[axis] += delta * weight;
        moving = true;
      } else {
        state[axis] = input[axis];
      }
    }
    snap = false;
    try {
      const reading = readingPoints.findIndex(point => point.getAttribute('aria-current') === 'step');
      view.draw({ w, h, ...state, focus: focused, reading, palette: home?.palette });
      host.classList.add('spatial-ready');
    } catch {
      fallback();
      return;
    }
    if (isHome && moving && lastDraw && elapsed < 150) {
      const budget = reducedResolution ? 40 : 31;
      slowTime = Math.max(0, slowTime + (elapsed > budget ? elapsed : -2 * elapsed));
      if (slowTime >= (reducedResolution ? 1200 : 550)) {
        if (reducedResolution) {
          fallback();
          return;
        }
        view.reduceResolution();
        reducedResolution = true;
        slowTime = 0;
      }
    } else if (!moving) {
      slowTime = 0;
    }
    lastDraw = moving ? now : 0;
    if (moving) schedule();
  }

  function schedule() {
    if (frame === 0 && view && active()) frame = requestAnimationFrame(draw);
  }

  async function prepare() {
    if (view || loading || !active()) return;
    const pending = new AbortController();
    loading = pending;
    const timeout = setTimeout(() => {
      if (loading === pending) fallback();
    }, 6500);

    try {
      const { createView } = await import('./renderer.js');
      if (!active() || pending.signal.aborted) return;
      const nextCanvas = document.createElement('canvas');
      nextCanvas.setAttribute('aria-hidden', 'true');
      const nextView = await createView(nextCanvas, name, { ...options, low: isHome && (compact.matches || compactHome.matches || lowCapacity), signal: pending.signal });
      if (!active() || pending.signal.aborted) {
        nextView.dispose();
        return;
      }
      canvas = nextCanvas;
      view = nextView;
      if (reducedResolution) view.reduceResolution();
      canvas.addEventListener('webglcontextlost', loseContext);
      canvas.addEventListener('webglcontextrestored', restoreContext);
      surface.append(canvas);
      schedule();
    } catch {
      if (loading === pending) fallback();
    } finally {
      clearTimeout(timeout);
      if (loading === pending) loading = null;
    }
  }

  function reconcile() {
    if (!requested()) {
      release();
      return;
    }
    if (!active()) {
      stopDrawing();
      loading?.abort();
      loading = null;
      snap = true;
      return;
    }
    if (view) schedule();
    else prepare();
  }

  if ('IntersectionObserver' in window) {
    visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= (inView ? .05 : .18);
      reconcile();
    }, { threshold: [0, .05, .18] });
    visibility.observe(surface);
  }

  if ('ResizeObserver' in window) {
    resizing = new ResizeObserver(schedule);
    resizing.observe(surface);
  }

  reduced.addEventListener('change', reconcile, events);
  compact.addEventListener('change', reconcile, events);
  if (isHome) compactHome.addEventListener('change', reconcile, events);
  connection?.addEventListener?.('change', reconcile, events);
  document.addEventListener('visibilitychange', reconcile, events);
  window.addEventListener('scroll', schedule, { ...events, passive: true });
  window.addEventListener('resize', schedule, events);

  if (!isHome) {
    surface.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || !active()) return;
      const rect = surface.getBoundingClientRect();
      input.x = Math.max(-1, Math.min(1, 2 * (event.clientX - rect.left) / rect.width - 1));
      input.y = Math.max(-1, Math.min(1, 1 - 2 * (event.clientY - rect.top) / rect.height));
      input.engagement = 1;
      schedule();
    }, { ...events, passive: true });
    surface.addEventListener('pointerleave', () => {
      input.x = 0;
      input.y = 0;
      input.engagement = focused < 0 ? 0 : 1;
      schedule();
    }, events);
  }

  for (const target of targets) {
    const select = () => {
      focused = Number(target.dataset.spatialTarget);
      input.engagement = 1;
      schedule();
    };
    const clear = () => {
      if (target === document.activeElement || target.matches(':hover')) return;
      focused = -1;
      input.engagement = 0;
      schedule();
    };
    target.addEventListener('pointerenter', select, events);
    target.addEventListener('pointerleave', clear, events);
    target.addEventListener('focus', select, events);
    target.addEventListener('blur', clear, events);
  }

  return () => {
    lifecycle.abort();
    visibility?.disconnect();
    resizing?.disconnect();
    release();
  };
}

if (stage) {
  let unmount = mount(stage);
  window.addEventListener('pagehide', () => unmount());
  window.addEventListener('pageshow', ({ persisted }) => {
    if (persisted) unmount = mount(stage);
  });
}
