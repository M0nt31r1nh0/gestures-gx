# Validation — 9 September 2026

Passed: 15 automated Node.js tests covering back/forward thresholds, momentum suppression, 100 consecutive alternating gestures, vertical/diagonal input, scroll-boundary ownership, isolated movement, restored-page lock expiry, direction reversal, per-tab request serialization, unavailable history recovery and the disabled setting.

Passed: JavaScript syntax checks and manifest/ZIP structure validation.

Not completed: real Chromium integration. Playwright is available, but its browser executable is absent and the browser download timed out. `tests/browser.cjs` is included for a browser-equipped development environment.

Not verified: Opera GX on Windows or macOS with a physical trackpad, native gesture interference, device-specific sensitivity, or Safari-equivalent animation. See the manual acceptance check in README.md.

Version 1.0.1 adds four content-handler tests, including reproduction of the old non-cancelable continuation failure and successful recognition after the fix. Physical-device failure cause remains unconfirmed.
