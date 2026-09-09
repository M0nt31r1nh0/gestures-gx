'use strict';
// Serialized per-tab decisions and session storage survive service-worker sleep.
const queues = new Map();
const keyFor = id => `glide:${id}`;
async function handle(message, sender) {
  const id = sender.tab?.id;
  if (!Number.isInteger(id)) return {ok: false};
  const key = keyFor(id);
  const state = (await chrome.storage.session.get(key))[key] || 0;
  const now = Date.now();
  if (message.type === 'glide:state') return {last: state};
  if (message.type === 'glide:pulse') {
    if (now - state < 1200) await chrome.storage.session.set({[key]: now});
    return {ok: true};
  }
  if (message.type !== 'glide:navigate' || !['back', 'forward'].includes(message.direction)) return {ok: false};
  const settings = await chrome.storage.local.get({enabled: true});
  if (!settings.enabled || now - state < 180) return {ok: false, blocked: true};
  await chrome.storage.session.set({[key]: now});
  // Share the lock with other frames before history navigation changes documents.
  chrome.tabs.sendMessage(id, {type: 'glide:lock', at: now}).catch(() => {});
  try {
    if (message.direction === 'back') await chrome.tabs.goBack(id);
    else await chrome.tabs.goForward(id);
    return {ok: true};
  } catch (_) { return {ok: false, unavailable: true}; }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message?.type?.startsWith('glide:')) return;
  const id = sender.tab?.id;
  const previous = queues.get(id) || Promise.resolve();
  const job = previous.catch(() => {}).then(() => handle(message, sender));
  queues.set(id, job);
  job.then(reply, () => reply({ok: false})).finally(() => {
    if (queues.get(id) === job) queues.delete(id);
  });
  return true;
});
chrome.tabs.onRemoved.addListener(id => { chrome.storage.session.remove(keyFor(id)); });
