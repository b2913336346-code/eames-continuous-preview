const back = document.querySelector('[data-home-return]');

back?.addEventListener('click', event => {
  if (event.button !== 0 || event.defaultPrevented || event.ctrlKey || event.metaKey
      || event.altKey || event.shiftKey || history.length < 2 || !document.referrer) return;

  const source = new URL(document.referrer);
  if (source.origin !== location.origin || source.pathname !== '/eames-continuous-preview/') return;

  // Browser history restores the exact position and focus of the card that was opened.
  event.preventDefault();
  history.back();
});
