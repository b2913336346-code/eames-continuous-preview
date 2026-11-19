const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function bindHomeInput(host, input, schedule, events) {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const work = document.querySelector('#work-section');
  const cards = [...work.querySelectorAll('[data-home-work]')];
  const sections = [...document.querySelectorAll('main [data-exhibit]')];
  const workIndex = sections.indexOf(work);
  const slots = sections.map(section => [...section.querySelectorAll('.exhibit-poster')]);
  const style = getComputedStyle(host);
  let stops = [];
  let hovered = -1;
  let tabbed = -1;
  let scrolled = -1;
  let selected = -1;
  let lastDark;
  let palette;

  function updatePalette() {
    const dark = root.classList.contains('dark');
    if (lastDark === dark) return;
    lastDark = dark;
    palette = {
      edge: style.getPropertyValue('--exhibit-edge').trim(),
      matte: style.getPropertyValue('--exhibit-matte').trim(),
      metal: style.getPropertyValue('--exhibit-metal').trim(),
      light: dark ? '#b7c9d8' : '#f2f7ff',
      intensity: dark ? 1.45 : 2.4,
    };
    schedule();
  }

  function measure() {
    const offset = parseFloat(style.getPropertyValue('--anchor-offset')) || 96;
    const bottom = Math.max(0, root.scrollHeight - root.clientHeight);
    stops = sections.map((section, index) => index
      ? clamp(scrollY + section.getBoundingClientRect().top - offset, 0, bottom)
      : 0);
  }

  function readingCard(y, height) {
    if (y <= stops[workIndex] + 32 || y >= stops[workIndex + 1]) return -1;
    const line = height * .46;
    const distances = cards.map(card => {
      const { top, bottom } = card.getBoundingClientRect();
      if (bottom < 78 || top > height * .86) return Infinity;
      return Math.abs((top + bottom) / 2 - line);
    });
    const nearest = distances.indexOf(Math.min(...distances));
    const previous = distances[scrolled] ?? Infinity;
    if (previous < height * .32 && previous <= distances[nearest] + 20) return scrolled;
    return distances[nearest] < height * .3 ? nearest : -1;
  }

  function read() {
    if (!stops.length) measure();
    const height = root.clientHeight;
    const y = scrollY;
    const next = stops.findIndex(stop => stop > y);
    if (next > 0) {
      const transitionStart = Math.max(stops[next - 1], stops[next] - height * .86);
      const progress = clamp((y - stops[next - 1]) / Math.max(1, stops[next] - stops[next - 1]), 0, 1);
      const change = clamp((y - transitionStart) / Math.max(1, stops[next] - transitionStart), 0, 1);
      input.scroll = next - 1 + .52 * progress + .48 * change;
    } else {
      input.scroll = stops.length - 1;
    }

    if (root.clientWidth <= 900) {
      const index = lastDark ? 1 : 0;
      const center = height * .54;
      let bestWeight = 0;
      let bestCenter = center;
      for (const images of slots) {
        const { top, height: slotHeight } = images[index].getBoundingClientRect();
        const middle = top + slotHeight / 2;
        const weight = clamp(1 - Math.abs(middle - center) / (height * .56), 0, 1);
        if (weight > bestWeight) {
          bestWeight = weight;
          bestCenter = middle;
        }
      }
      const target = clamp(bestCenter / height, .23, .80);
      input.mobileY = .5 - (.59 + (target - .59) * bestWeight);
      input.mobileFade = .22 + .78 * bestWeight;
    }
    scrolled = readingCard(y, height);
    const { top, bottom } = work.getBoundingClientRect();
    const workVisible = top < height * .9 && bottom > 96;
    const focus = workVisible ? (tabbed >= 0 ? tabbed : hovered >= 0 ? hovered : scrolled) : -1;
    if (focus !== selected) {
      selected = focus;
      cards.forEach((card, index) => card.classList.toggle('home-work-active', index === focus));
    }
    input.work01 = Number(focus === 0);
    input.work02 = Number(focus === 1);
    input.work03 = Number(focus === 2);
    if (input.scroll > .62 && !workVisible) resetPointer(false);
  }

  function resetPointer(refresh = true) {
    if (!input.x && !input.y) return;
    input.x = 0;
    input.y = 0;
    if (refresh) schedule();
  }

  for (const [index, card] of cards.entries()) {
    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = index;
      schedule();
    }, events);
    card.addEventListener('pointerleave', () => {
      hovered = -1;
      schedule();
    }, events);
    card.addEventListener('focus', () => {
      tabbed = index;
      schedule();
    }, events);
    card.addEventListener('blur', () => {
      tabbed = -1;
      schedule();
    }, events);
  }

  for (const section of [hero, work]) {
    section.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || event.target.closest('a, button, h1, h2, h3, p')) {
        resetPointer();
        return;
      }
      input.x = clamp(2 * event.clientX / root.clientWidth - 1, -1, 1);
      input.y = clamp(1 - 2 * event.clientY / root.clientHeight, -1, 1);
      schedule();
    }, { ...events, passive: true });
    section.addEventListener('pointerleave', () => resetPointer(), events);
  }
  window.addEventListener('mouseout', event => {
    if (!event.relatedTarget) resetPointer();
  }, events);
  window.addEventListener('hashchange', schedule, events);
  window.addEventListener('load', () => { measure(); schedule(); }, events);

  const theme = new MutationObserver(updatePalette);
  theme.observe(root, { attributes: true, attributeFilter: ['class'] });
  const layout = new ResizeObserver(() => { measure(); schedule(); });
  layout.observe(document.querySelector('main'));
  layout.observe(root);
  events.signal.addEventListener('abort', () => {
    theme.disconnect();
    layout.disconnect();
    cards.forEach(card => card.classList.remove('home-work-active'));
  }, { once: true });

  measure();
  updatePalette();
  return { read, get palette() { return palette; } };
}
