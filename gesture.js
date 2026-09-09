/* Pure recognizer shared by the extension and deterministic tests. */
(function (root) {
  'use strict';
  class Gesture {
    constructor() { this.idle = 180; this.reset(); }
    reset() { this.last = -Infinity; this.mode = 'pending'; this.x = 0; this.y = 0; this.count = 0; }
    block(now) { this.reset(); this.last = now; this.mode = 'fired'; }
    feed({x, y, now, protectedArea = false, threshold = 52}) {
      if (now - this.last > this.idle) this.reset();
      this.last = now;
      if (this.mode === 'fired') return {consume: true, pulse: true};
      if (this.mode === 'scroll') return {consume: false};
      if (protectedArea) { this.mode = 'scroll'; return {consume: false}; }
      this.x += x; this.y += Math.abs(y); this.count++;
      const ax = Math.abs(this.x);
      if (this.mode === 'pending') {
        if (this.y >= 9 && this.y > ax * 0.8) this.mode = 'scroll';
        else if (ax >= 9 && ax > this.y * 1.8) this.mode = 'horizontal';
      }
      if (this.mode !== 'horizontal') return {consume: false};
      const direction = this.x < 0 ? 'back' : 'forward';
      if (ax >= threshold && this.count >= 2) {
        this.mode = 'fired';
        return {consume: true, fire: direction, progress: 1};
      }
      return {consume: true, direction, progress: Math.min(ax / threshold, 1)};
    }
  }
  root.GlideGesture = Gesture;
  if (typeof module !== 'undefined') module.exports = Gesture;
})(globalThis);
