'use strict';
const defaults = {enabled: true, reverse: false, sensitivity: 'balanced', feedback: true};
const status = document.getElementById('status');
let statusTimer;
function flashStatus(text) {
  clearTimeout(statusTimer);
  status.textContent = text;
  status.style.opacity = '1';
  statusTimer = setTimeout(() => { status.style.opacity = '0'; }, 1600);
}
(async () => {
  try {
    const values = await chrome.storage.local.get(defaults);
    for (const key of ['enabled', 'reverse', 'feedback']) {
      const input = document.getElementById(key);
      input.checked = values[key];
      input.addEventListener('change', async () => {
        try {
          await chrome.storage.local.set({[key]: input.checked});
          flashStatus('Saved');
        } catch (_) { clearTimeout(statusTimer); status.style.opacity = '1'; status.textContent = 'Could not save. Please try again.'; }
      });
    }

    const segButtons = document.querySelectorAll('#sensitivity .seg-btn');
    function setSensitivity(value) {
      for (const btn of segButtons) {
        const active = btn.dataset.value === value;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      }
    }
    setSensitivity(values.sensitivity);
    for (const btn of segButtons) {
      btn.addEventListener('click', async () => {
        const value = btn.dataset.value;
        setSensitivity(value);
        try {
          await chrome.storage.local.set({sensitivity: value});
          flashStatus('Saved');
        } catch (_) { clearTimeout(statusTimer); status.style.opacity = '1'; status.textContent = 'Could not save. Please try again.'; }
      });
    }
  } catch (_) { status.style.opacity = '1'; status.textContent = 'Could not load settings. Reopen this popup.'; }
})();

const diagDot = document.getElementById('diagDot');
const diagStatusText = document.getElementById('diagStatusText');
const diagGrid = document.getElementById('diagGrid');
const diagEvents = document.getElementById('diagEvents');
const diagHorizontal = document.getElementById('diagHorizontal');
const diagXY = document.getElementById('diagXY');
const diagReason = document.getElementById('diagReason');
const diagNav = document.getElementById('diagNav');
function setDot(state) { diagDot.className = 'dot' + (state ? ' ' + state : ''); }

async function checkPage() {
  setDot('');
  diagStatusText.textContent = 'Checking this page…';
  diagGrid.hidden = true;
  diagReason.textContent = '';
  diagNav.textContent = '';
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw Error('No tab');
    const d = await chrome.tabs.sendMessage(tab.id, {type: 'glide:diagnostics'}, {frameId: 0});
    if (!d?.version) throw Error('Old content script');
    setDot(d.ready && d.enabled ? 'good' : 'warn');
    diagStatusText.textContent = `${d.ready ? 'Connected' : 'Initializing'} · ${d.enabled ? 'Enabled' : 'Disabled'}`;
    diagGrid.hidden = false;
    diagEvents.textContent = d.events;
    diagHorizontal.textContent = d.horizontalEvents;
    diagXY.textContent = `${d.x}, ${d.y}`;
    diagReason.textContent = d.reason;
    diagNav.textContent = d.navigation;
  } catch (_) {
    setDot('bad');
    diagStatusText.textContent = 'Not connected';
    diagReason.textContent = 'Refresh a regular webpage after loading v1.0.1. Browser settings, Speed Dial and other protected pages are unsupported.';
  }
}
document.getElementById('check').addEventListener('click', checkPage);
checkPage();
