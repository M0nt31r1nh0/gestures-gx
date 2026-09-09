# Glide GX — Trackpad Navigation

A lightweight Manifest V3 extension for Opera GX. Two-finger horizontal trackpad swipes navigate the current tab's history, with edge-arrow feedback and adjustable sensitivity. No build step or external runtime libraries.

## Install in Opera GX

1. Extract the ZIP to a permanent folder on your computer.
2. Disable/remove your previous gesture extension to avoid conflicting handlers.
3. Open `opera://extensions` in Opera GX.
4. Turn on **Developer mode**, choose **Load unpacked**, then select the extracted **glide-gx** folder containing `manifest.json`.
5. Refresh any webpages that were already open. Pin Glide GX from Opera's extension menu if you want quick access to settings.
6. Visit two webpages in the same tab and test a two-finger horizontal swipe over the webpage.

Keep the extracted folder in place; Opera loads the extension from that folder. The ZIP is source for an unpacked installation, not a store-signed extension.

## Gestures and settings

- With natural scrolling: move two fingers right for Back, left for Forward.
- Depending on the operating system's scrolling configuration, directions may be inverted. Use **Reverse direction** in the popup to match your preference.
- **Fast**: 34 normalized pixels. **Balanced** (default): 52. **Deliberate**: 82.
- At least two wheel events and a clear horizontal direction are required. Navigation occurs at the threshold without waiting for finger release.
- **Show edge arrows** controls lightweight visual feedback. Disable it if you prefer no overlay.
- **Trackpad navigation** enables/disables navigation on all supported pages.

## Scrolling and repeated navigation

Vertical and diagonal scrolling, pinch zoom, and modified wheel input are left alone. Text inputs, editable content and sliders are protected. Horizontally scrollable content keeps a gesture when it can scroll in that direction; reaching its boundary requires a new swipe before navigation can begin. Right-to-left horizontal scrollers are conservatively protected.

Each gesture can navigate once. Momentum is ignored until 180 ms without wheel input. Per-tab session state carries this protection across page loads and browser history restoration. This is an idle detector, not a fixed delay following every navigation; continuous momentum extends the lock.

Trackpad wheel events do not expose finger count or a reliable finger-release/momentum flag. An extremely long gap within momentum may look like a fresh gesture; swipes made less than 180 ms apart can be grouped together. The physical trackpad is the final check for tuning.

## Where it works

Regular HTTP/HTTPS webpages, including permitted frames. The pointer must be over page content. Browser settings, Speed Dial, extension stores, the address/tab bars, built-in PDF viewers and other restricted surfaces cannot be controlled by this content-script extension. File URLs are not included.

If your OS or browser intercepts a gesture before forwarding horizontal wheel events, the extension cannot detect it. Use two-finger scrolling gestures, not OS-reserved three/four-finger gestures. Custom canvas applications may need Glide GX disabled while you use their horizontal gestures. Sites can mark a region with `data-glide-ignore` to opt it out.

This approximates macOS navigation gestures; it does not reproduce Safari's native live page-transition animation.

## Privacy and permissions

All code and settings stay local. No analytics, network requests, browsing-history collection or external services. The storage permission saves settings and short-lived per-tab gesture timestamps. Content scripts run on HTTP/HTTPS pages to receive scrolling events; the background worker uses the sender's tab ID for history navigation. No broad `tabs` permission is requested.

## Development and tests

- `gesture.js`: pure gesture state machine.
- `content.js`: wheel input, scrolling protection and edge arrows.
- `background.js`: serialized navigation and per-tab momentum state.
- `popup.*`: local settings UI.

Run deterministic gesture/background tests with Node.js:

```sh
node --test tests/gesture.test.cjs tests/content.test.cjs
```

Optional Chromium integration test (requires Playwright and its Chromium browser):

```sh
node tests/browser.cjs
```

The integration test starts a temporary loopback HTTP server and loads the real unpacked extension. It exercises navigation, scrolling and settings. This is not a substitute for testing in Opera GX on your actual trackpad.

## Quick manual acceptance check

1. Navigate A → B → C. Swipe back once: B. Let go, swipe back: A.
2. Swipe forward twice, releasing between swipes: B, then C.
3. Try a long flick: only one history entry should be traversed.
4. Scroll vertically and inside a horizontal container: no history navigation.
5. Change sensitivity and reverse direction from the popup; settings should take effect immediately.
6. Try Back on the first history entry, then browse to another page: future swipes should still work.
7. Revisit a page using Back/Forward and repeat gestures to check restored-page behavior.

## Version 1.0.1: compatibility fix and page diagnostics

Fixed a recognizer blocker where non-cancelable continuation events aborted a valid swipe. Cancellation now controls only preventDefault, not recognition.

To update, extract this ZIP over your existing extension folder, click Reload on Glide GX at opera://extensions, and refresh the webpage. Alternatively remove the old extension and load the new extracted folder. The popup should show v1.0.1.

If navigation still fails, close the popup, swipe over the main webpage (outside embedded frames), and reopen Glide GX. Send a screenshot of **Page check**. It reports connection, wheel events received, horizontal events, latest X/Y movement and navigation outcome. This data stays in page memory and is lost when the page unloads; no activity is uploaded or saved to disk.

- Not connected: refresh a regular webpage and check the extension is enabled/allowed there.
- Zero wheel events after a swipe: the main page did not receive that gesture, or you swiped over an embedded frame.
- Wheel events but zero horizontal events: horizontal trackpad motion is not being delivered as horizontal wheel input.
- Scrollable or editable area: test over a blank, non-scrolling part of the page.
- No history in this direction: check that the browser Back/Forward button is available; try reversing direction.
