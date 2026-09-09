const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Gesture = require('../gesture.js');
async function harness(legacy = false) {
  const events = {}, messages = [];
  let now = 1000, listener;
  const context = {
    GlideGesture: Gesture, Date: {now: () => now}, Element: class {},
    innerWidth: 1000, document: {scrollingElement: null},
    setTimeout: () => 1, clearTimeout: () => {}, requestAnimationFrame: () => 1,
    addEventListener: (name, fn) => events[name] = fn,
    chrome: {
      storage: {local: {get: async defaults => ({...defaults, feedback: false})}, onChanged: {addListener: () => {}}},
      runtime: {sendMessage: async message => {messages.push(message); return message.type === 'glide:state' ? {last: 0} : {ok: true};}, onMessage: {addListener: fn => listener = fn}}
    }
  };
  let code = fs.readFileSync(require.resolve('../content.js'), 'utf8');
  if (legacy) code = code.replace('    // Later events in a valid wheel sequence may be non-cancelable.', "    if (!event.cancelable && engine.mode !== 'fired') { engine.mode = 'scroll'; engine.last = now; hide(); return; }");
  vm.runInNewContext(code, context);
  await new Promise(setImmediate);
  return {
    messages,
    wheel(options = {}) {now += 12; events.wheel({isTrusted: true, cancelable: true, deltaMode: 0, deltaX: -20, deltaY: 0, composedPath: () => [], preventDefault: () => {}, ...options});},
    async diagnostics() {await new Promise(setImmediate); let result; listener({type: 'glide:diagnostics'}, {}, x => result = x); return result;}
  };
}
test('regression: old gate loses a swipe with non-cancelable continuation events', async () => {
  const h = await harness(true);
  h.wheel(); h.wheel({cancelable: false}); h.wheel({cancelable: false});
  assert.equal(h.messages.filter(m => m.type === 'glide:navigate').length, 0);
});
test('fixed content handler navigates once with non-cancelable continuation', async () => {
  const h = await harness();
  h.wheel(); h.wheel({cancelable: false}); h.wheel({cancelable: false}); h.wheel({cancelable: false});
  const requests = h.messages.filter(m => m.type === 'glide:navigate');
  assert.equal(requests.length, 1); assert.equal(requests[0].direction, 'back');
  const d = await h.diagnostics();
  assert.equal(d.events, 4); assert.equal(d.horizontalEvents, 4);
  assert.equal(d.navigation, 'Navigation accepted');
});
test('diagnostics distinguish vertical-only input from unreceived events', async () => {
  const h = await harness();
  assert.equal((await h.diagnostics()).events, 0);
  h.wheel({deltaX: 0, deltaY: 40});
  const d = await h.diagnostics();
  assert.equal(d.events, 1); assert.equal(d.horizontalEvents, 0);
  assert.equal(d.reason, 'Ordinary scrolling');
  assert.equal(h.messages.filter(m => m.type === 'glide:navigate').length, 0);
});
test('pinch zoom is still protected', async () => {
  const h = await harness();
  h.wheel({ctrlKey: true}); h.wheel({ctrlKey: true}); h.wheel({ctrlKey: true});
  assert.equal((await h.diagnostics()).reason, 'Modified wheel / zoom');
  assert.equal(h.messages.filter(m => m.type === 'glide:navigate').length, 0);
});
