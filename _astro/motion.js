const root = document.documentElement;
const header = document.querySelector('header.nav');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const revealItems = [...document.querySelectorAll('.reveal')];
const revealed = new WeakSet();
const sections = [...document.querySelectorAll('[data-section-nav]')];
const navLinks = [...document.querySelectorAll('.navlinks a, .mobile-panel a')];
const journey = document.querySelector('[data-journey]');
const events = [...(journey?.querySelectorAll('.event') ?? [])];
const toc = document.querySelector('.article-toc');
const chapterNav = toc?.querySelector('nav') ?? document.querySelector('[data-in-page-nav]');
const chapterLinks = [...(chapterNav?.querySelectorAll('a[href^="#"]') ?? [])];
const chapterTargets = chapterLinks.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))));
const tocCurrent = toc?.querySelector('.toc-current');
const videos = [...document.querySelectorAll('video.project-video')];

let controller;
let observer;
let layoutObserver;
let frame = 0;
let themeTimer = 0;
let activeSection;
let activeEvent;
let activeChapter;
let anchorOffset;

const progressLine = toc && header ? document.createElement('div') : null;
if (progressLine) {
  progressLine.className = 'reading-progress';
  progressLine.setAttribute('aria-hidden', 'true');
  header.append(progressLine);
}

const replayButtons = videos.map(video => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn video-replay';
  button.textContent = '从头播放';
  (video.closest('figure')?.querySelector('figcaption') ?? video.parentElement).append(button);
  return button;
});

function observeReveals() {
  observer?.disconnect();
  for (const item of revealItems) item.classList.remove('reveal-is-entering');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

  try {
    observer = new IntersectionObserver(entries => {
      const fragment = document.querySelector(':target');
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting || revealed.has(target)) continue;
        revealed.add(target);
        observer.unobserve(target);
        const parentIsEntering = target.parentElement.closest('.reveal-is-entering')?.getAnimations().length;
        if (!parentIsEntering && !target.matches(':focus-within') && !target.contains(fragment)) {
          target.classList.add('reveal-is-entering');
        }
      }
    });

    for (const item of revealItems) {
      if (item.getBoundingClientRect().top < innerHeight) revealed.add(item);
      if (!revealed.has(item)) observer.observe(item);
    }
  } catch {
    observer?.disconnect();
  }
}

function currentAt(elements, readingLine) {
  let current;
  let closestTop = -Infinity;
  for (const element of elements) {
    if (!element) continue;
    const { top } = element.getBoundingClientRect();
    if (top <= readingLine && top > closestTop) {
      closestTop = top;
      current = element;
    }
  }
  return current;
}

function updateReadingState() {
  frame = 0;
  const viewportHeight = root.clientHeight;
  const scrollable = root.scrollHeight - viewportHeight;
  const bottom = scrollable > 0 && scrollY >= scrollable - 2;
  if (sections.length) {
    const section = bottom ? sections.at(-1) : currentAt(sections, anchorOffset + 8) ?? sections[0];
    if (section !== activeSection) {
      activeSection = section;
      for (const link of navLinks) {
        if (link.pathname === section.dataset.sectionNav) {
          link.setAttribute('aria-current', section === sections[0] ? 'page' : 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      }
    }
  }

  const readingLine = Math.max(anchorOffset, viewportHeight * .36);
  if (events.length) {
    const event = currentAt(events, readingLine);
    if (event !== activeEvent) {
      activeEvent?.removeAttribute('aria-current');
      event?.setAttribute('aria-current', 'step');
      activeEvent = event;
    }

    if (!reducedMotion.matches) {
      const first = events[0].getBoundingClientRect().top + 13;
      const last = events.at(-1).getBoundingClientRect().top + 13;
      const length = Math.max(0, last - first);
      journey.style.setProperty('--journey-length', `${length}px`);
      journey.style.setProperty('--journey-progress', String(Math.min(1, Math.max(0, (readingLine - first) / (length || 1)))));
    }
  }

  if (chapterLinks.length) {
    const chapter = bottom ? chapterTargets.at(-1) : currentAt(chapterTargets, readingLine);
    if (chapter !== activeChapter) {
      const previous = chapterLinks[chapterTargets.indexOf(activeChapter)];
      const current = chapterLinks[chapterTargets.indexOf(chapter)];
      previous?.removeAttribute('aria-current');
      current?.setAttribute('aria-current', 'location');
      if (tocCurrent) {
        tocCurrent.textContent = current?.textContent ?? '';
        tocCurrent.hidden = !current;
      }
      activeChapter = chapter;
    }

    if (progressLine) {
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
      progressLine.style.setProperty('--reading-progress', String(progress));
    }
  }

  for (const video of videos) {
    if (video.paused) continue;
    const rect = video.getBoundingClientRect();
    if (rect.top >= viewportHeight || rect.bottom <= (header?.getBoundingClientRect().bottom ?? 0)) video.pause();
  }
}

function scheduleReadingUpdate() {
  if (!frame) frame = requestAnimationFrame(updateReadingState);
}

function updateViewport() {
  anchorOffset = parseFloat(getComputedStyle(root).getPropertyValue('--anchor-offset')) || 0;
  scheduleReadingUpdate();
}

function syncDisclosure(details, panel) {
  if (!details.open && panel.contains(document.activeElement)) details.querySelector('summary').focus();
  panel.inert = !details.open;
}

function start() {
  controller = new AbortController();
  const options = { signal: controller.signal };

  observeReveals();
  reducedMotion.addEventListener('change', () => {
    observeReveals();
    scheduleReadingUpdate();
  }, options);

  document.addEventListener('focusin', ({ target }) => {
    let item = target.closest('.reveal');
    while (item) {
      observer?.unobserve(item);
      revealed.add(item);
      item.classList.remove('reveal-is-entering');
      item = item.parentElement.closest('.reveal');
    }
  }, options);

  document.querySelector('#theme')?.addEventListener('click', () => {
    if (!root.classList.contains('theme-transition')) {
      root.classList.add('theme-transition');
      // Read the pre-toggle style so the first click can transition too.
      getComputedStyle(document.body).backgroundColor;
    }
    clearTimeout(themeTimer);
    const duration = parseFloat(getComputedStyle(root).getPropertyValue('--motion-theme')) || 240;
    themeTimer = setTimeout(() => root.classList.remove('theme-transition'), duration + 50);
  }, { ...options, capture: true });

  for (const details of document.querySelectorAll('.article-toc, .feature-panel, .contact-code')) {
    const panel = details.querySelector(':scope > :is(nav, .feature-content, figure)');
    if (!panel) continue;
    syncDisclosure(details, panel);
    details.addEventListener('toggle', () => {
      syncDisclosure(details, panel);
      scheduleReadingUpdate();
    }, options);
  }

  videos.forEach((video, index) => {
    const cover = video.parentElement.querySelector('.project-video-start');
    if (cover) {
      cover.hidden = video.played.length > 0;
      cover.addEventListener('click', async () => {
        try {
          await video.play();
        } catch {
          // The native controls and direct video link remain available.
        }
      }, options);
    }
    video.addEventListener('play', () => {
      if (cover) {
        if (document.activeElement === cover) video.focus({ preventScroll: true });
        cover.hidden = true;
      }
      scheduleReadingUpdate();
    }, options);
    replayButtons[index].addEventListener('click', async () => {
      try {
        video.scrollIntoView({ block: 'center', behavior: 'instant' });
        video.currentTime = 0;
        await video.play();
      } catch {
        // The native controls and direct video link remain available.
      }
    }, options);
  });

  if (sections.length || events.length || chapterLinks.length || videos.length) {
    window.addEventListener('scroll', scheduleReadingUpdate, { ...options, passive: true });
    window.addEventListener('resize', updateViewport, options);
    window.addEventListener('hashchange', scheduleReadingUpdate, options);
    window.addEventListener('load', scheduleReadingUpdate, options);
    if ('ResizeObserver' in window) {
      layoutObserver = new ResizeObserver(scheduleReadingUpdate);
      layoutObserver.observe(document.querySelector('main'));
    }
    updateViewport();
  }
}

function stop() {
  controller.abort();
  observer?.disconnect();
  layoutObserver?.disconnect();
  cancelAnimationFrame(frame);
  clearTimeout(themeTimer);
  root.classList.remove('theme-transition');
  for (const video of videos) video.pause();
  frame = 0;
}

window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', event => {
  if (event.persisted) start();
});
start();
