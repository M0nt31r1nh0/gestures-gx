(() => {
  'use strict';
  if (globalThis.__glideGX) return;
  globalThis.__glideGX = true;
  const engine = new GlideGesture();
  let settings = {enabled: true, reverse: false, sensitivity: 'balanced', feedback: true};
  let ready = false, timer, host, bubble, lastPulse = 0, frame = 0, pending;
  const diagnostics = {events: 0, horizontalEvents: 0, x: 0, y: 0, reason: 'Waiting for a swipe', navigation: 'Not attempted'};
  const thresholds = {fast: 34, balanced: 52, deliberate: 82};
  const send = message => chrome.runtime.sendMessage(message).catch(() => null);
  async function initialize() {
    ready = false;
    engine.reset();
    try {
      const [stored, state] = await Promise.all([chrome.storage.local.get(settings), send({type: 'glide:state'})]);
      settings = stored;
      if (state?.last && Date.now() - state.last < engine.idle) engine.block(state.last);
      ready = true;
    } catch (_) { ready = false; }
  }
  function hide() { if (bubble) bubble.style.opacity = '0'; }
  function show(direction, progress, text) {
    if (!settings.feedback) return;
    pending = {direction, progress, text};
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!document.documentElement) return;
      if (!host) {
        host = document.createElement('div');
        host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
        const shadow = host.attachShadow({mode: 'closed'});
        bubble = document.createElement('div');
        bubble.style.cssText = 'position:absolute;top:46%;padding:13px 17px;border-radius:24px;background:rgba(25,25,32,.92);color:white;font:600 24px system-ui;box-shadow:0 4px 24px #0004;opacity:0;transition:opacity 90ms;white-space:nowrap;';
        shadow.append(bubble); document.documentElement.append(host);
      }
      const {direction: d, progress: p, text: t} = pending;
      bubble.textContent = t || (d === 'back' ? '←' : '→');
      bubble.style.left = d === 'back' ? '14px' : 'auto';
      bubble.style.right = d === 'forward' ? '14px' : 'auto';
      bubble.style.transform = `scale(${0.8 + 0.2 * p})`;
      bubble.style.opacity = String(0.45 + p * 0.55);
    });
  }
  function protectedTarget(event, x) {
    // Check the composed path once per gesture. Preserve carousels, editors,
    // horizontally scrolling ancestors and native scrolling at their boundary.
    for (const el of event.composedPath()) {
      if (!(el instanceof Element)) continue;
      if (el.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],[data-glide-ignore]')) return true;
      if (el.scrollWidth <= el.clientWidth + 2) continue;
      const style = getComputedStyle(el);
      if (!/auto|scroll|overlay/.test(style.overflowX)) continue;
      if (style.direction === 'rtl') return true;
      if ((x > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2) || (x < 0 && el.scrollLeft > 2)) return true;
    }
    const page = document.scrollingElement;
    return !!(page && page.scrollWidth > page.clientWidth + 2 &&
      ((x > 0 && page.scrollLeft + page.clientWidth < page.scrollWidth - 2) || (x < 0 && page.scrollLeft > 2)));
  }
  function wheel(event) {
    if (!event.isTrusted) return;
    diagnostics.events++;
    diagnostics.x = event.deltaX; diagnostics.y = event.deltaY;
    if (event.deltaX) diagnostics.horizontalEvents++;
    if (!ready || !settings.enabled) { diagnostics.reason = ready ? 'Disabled' : 'Still initializing'; return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) { diagnostics.reason = 'Modified wheel / zoom'; engine.reset(); hide(); return; }
    const now = Date.now();
    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerWidth : 1;
    const x = event.deltaX * factor, y = event.deltaY * factor;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (!x && !y)) return;
    const fresh = now - engine.last > engine.idle;
    const protect = (fresh || engine.mode === 'pending') && protectedTarget(event, x);
    // Later events in a valid wheel sequence may be non-cancelable.
    // Keep recognizing them; only preventDefault requires cancelability.
    const result = engine.feed({x, y, now, protectedArea: protect, threshold: thresholds[settings.sensitivity] || 52});
    diagnostics.reason = protect ? 'Scrollable or editable area' : engine.mode === 'scroll' ? 'Ordinary scrolling' : engine.mode === 'fired' ? 'Gesture committed / momentum' : engine.mode === 'horizontal' ? 'Horizontal swipe below threshold' : 'Waiting for clear horizontal movement';
    clearTimeout(timer);
    timer = setTimeout(hide, engine.idle + 20);
    if (result.consume && event.cancelable) event.preventDefault();
    if (result.pulse && now - lastPulse > 60) { lastPulse = now; send({type: 'glide:pulse'}); }
    const raw = result.fire || result.direction;
    const direction = settings.reverse && raw ? (raw === 'back' ? 'forward' : 'back') : raw;
    if (direction) show(direction, result.progress);
    if (result.fire) {
      lastPulse = now;
      diagnostics.navigation = 'Requesting ' + direction;
      send({type: 'glide:navigate', direction}).then(response => {
        diagnostics.navigation = !response ? 'Background unavailable: reload extension and page' : response.unavailable ? 'No history in this direction or navigation API failed' : response.blocked ? 'Momentum lock or disabled setting' : response.ok ? 'Navigation accepted' : 'Background error';
        if (response?.unavailable) show(direction, 1, direction === 'back' ? 'No previous page' : 'No next page');
      });
    }
  }
  addEventListener('wheel', wheel, {passive: false, capture: true});
  addEventListener('pageshow', initialize);
  addEventListener('pagehide', () => { ready = false; hide(); });
  addEventListener('blur', () => { engine.reset(); hide(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of Object.keys(settings)) if (changes[key]) settings[key] = changes[key].newValue;
    engine.reset(); hide();
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type === 'glide:diagnostics') { reply({version: '1.0.1', ready, enabled: settings.enabled, ...diagnostics}); return; }
    if (message?.type === 'glide:lock') engine.block(message.at);
  });
  initialize();
})();
