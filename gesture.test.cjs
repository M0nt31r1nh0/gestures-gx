const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Gesture = require('../gesture.js');
function swipe(g, start, sign = -1, extra = {}) {
  return [0, 12, 24, 36].map((t) => g.feed({x: sign * 18, y: 1, now: start + t, ...extra}));
}
test('back and forward fire at threshold without waiting for release', () => {
  for (const [sign, direction] of [[-1, 'back'], [1, 'forward']]) {
    const r = swipe(new Gesture(), 0, sign);
    assert.equal(r[2].fire, direction);
    assert.equal(r.filter(x => x.fire).length, 1);
  }
});
test('momentum does not cause another navigation; new swipe works', () => {
  const g = new Gesture(); swipe(g, 0);
  for (let t = 48; t < 900; t += 12) assert.ok(!g.feed({x: -4, y: 0, now: t}).fire);
  assert.equal(swipe(g, 1200, 1).filter(x => x.fire).length, 1);
});
test('100 consecutive alternating gestures never get stuck', () => {
  const g = new Gesture();
  for (let i = 0; i < 100; i++) assert.equal(swipe(g, i * 400, i % 2 ? 1 : -1).filter(x => x.fire).length, 1);
});
test('vertical and diagonal scrolling never navigate', () => {
  for (const x of [1, 10, 18]) {
    const g = new Gesture();
    for (let i = 0; i < 30; i++) {
      const r = g.feed({x, y: 20, now: i * 12});
      assert.equal(r.consume, false); assert.ok(!r.fire);
    }
  }
});
test('scrollable area owns whole gesture, even after its boundary', () => {
  const g = new Gesture();
  g.feed({x: 20, y: 0, now: 0, protectedArea: true});
  assert.ok(swipe(g, 12, 1).every(x => !x.consume));
  assert.equal(swipe(g, 400, 1).filter(x => x.fire).length, 1);
});
test('short accidental movement and isolated huge event do not navigate', () => {
  const g = new Gesture();
  assert.ok(!g.feed({x: 200, y: 0, now: 0}).fire);
  assert.ok(!g.feed({x: 3, y: 0, now: 400}).fire);
});
test('restored-page momentum lock expires after inactivity', () => {
  const g = new Gesture(); g.block(100);
  assert.ok(!g.feed({x: -80, y: 0, now: 180}).fire);
  assert.equal(swipe(g, 500).filter(x => x.fire).length, 1);
});
test('direction reversal before commitment cancels accumulated distance', () => {
  const g = new Gesture();
  g.feed({x: -30, y: 0, now: 0});
  const r = g.feed({x: 30, y: 0, now: 10});
  assert.ok(!r.fire); assert.equal(r.progress, 0);
});
function background() {
  let listener, removed;
  let now = 1000;
  const session = {}, settings = {enabled: true}, calls = [];
  const chrome = {
    runtime: {onMessage: {addListener: fn => listener = fn}},
    storage: {
      session: {get: async key => ({[key]: session[key]}), set: async value => Object.assign(session, value), remove: async key => delete session[key]},
      local: {get: async () => settings}
    },
    tabs: {onRemoved: {addListener: fn => removed = fn}, sendMessage: async () => {},
      goBack: async id => {calls.push(['back', id]); if (id === 99) throw Error('No history');},
      goForward: async id => calls.push(['forward', id])}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../background.js'), 'utf8'), {chrome, Date: {now: () => now}, Map, Promise});
  return {calls, session, settings, removed: id => removed(id), time: n => now = n,
    send: (type, direction, id = 7) => new Promise(resolve => listener({type: `glide:${type}`, direction}, {tab: {id}}, resolve))};
}
test('background targets originating tab and serializes duplicate requests', async () => {
  const b = background();
  const r = await Promise.all([b.send('navigate', 'back'), b.send('navigate', 'forward')]);
  assert.equal(r[0].ok, true); assert.equal(r[1].blocked, true);
  assert.deepEqual(b.calls, [['back', 7]]);
  b.time(1400); await b.send('navigate', 'forward');
  assert.deepEqual(b.calls[1], ['forward', 7]);
});
test('background shares momentum time, recovers from unavailable history', async () => {
  const b = background();
  assert.equal((await b.send('navigate', 'back', 99)).unavailable, true);
  b.time(1100); await b.send('pulse', null, 99);
  assert.equal((await b.send('state', null, 99)).last, 1100);
  b.time(1500); assert.equal((await b.send('navigate', 'forward', 99)).ok, true);
  await b.removed(99); assert.equal(b.session['glide:99'], undefined);
});
test('disabled extension does not navigate', async () => {
  const b = background(); b.settings.enabled = false;
  await b.send('navigate', 'back'); assert.equal(b.calls.length, 0);
});
