// Run with Playwright installed (NODE_PATH may point at its node_modules).
const {chromium} = require('playwright');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><title>${req.url}</title><style>body{height:2400px;font:20px system-ui}#scroll{width:300px;height:120px;overflow:auto;background:#ddd}#wide{width:1800px}iframe{width:400px;height:160px}</style><h1>${req.url}</h1><a href='/b'>Page B</a><div id='scroll'><div id='wide'>Horizontal scroll content</div></div><textarea>Editor</textarea>${req.url === '/frame' ? '' : "<iframe src='/frame'></iframe>"}`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let context;
  try {
    const extension = path.resolve(__dirname, '..');
    context = await chromium.launchPersistentContext('', {headless: true, channel: 'chromium', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox']});
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', {timeout: 10000});
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/a'); await page.goto(url + '/b');
    await page.waitForTimeout(250);
    async function swipe(x) {
      await page.mouse.move(750, 300);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(x, 0); await page.waitForTimeout(15); }
    }
    await swipe(-20);
    await page.waitForURL(url + '/a');
    console.log('PASS browser back navigation');
    await page.waitForTimeout(260);
    await swipe(20);
    await page.waitForURL(url + '/b');
    console.log('PASS browser forward navigation');
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(260); await swipe(-20); await page.waitForURL(url + '/a');
      await page.waitForTimeout(260); await swipe(20); await page.waitForURL(url + '/b');
    }
    console.log('PASS repeated back/forward cycles');
    await page.waitForTimeout(260);
    await page.mouse.wheel(0, 180); await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => scrollY) > 0); assert.equal(page.url(), url + '/b');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(260);
    const rect = await page.locator('#scroll').boundingBox();
    await page.mouse.move(rect.x + 50, rect.y + 50);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(30, 0);
    await page.waitForTimeout(80);
    assert.ok(await page.locator('#scroll').evaluate(e => e.scrollLeft) > 0);
    assert.equal(page.url(), url + '/b');
    console.log('PASS vertical and horizontal scrolling');
    const id = new URL(worker.url()).host;
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#reverse').check();
    await popup.waitForFunction(() => document.querySelector('#status').textContent === 'Saved');
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('reverse')).reverse), true);
    await popup.screenshot({path: path.resolve(__dirname, '../../glide-popup.png')});
    await page.bringToFront(); await page.waitForTimeout(260); await swipe(20); await page.waitForURL(url + '/a');
    console.log('PASS settings persistence and reverse direction');
    assert.deepEqual(errors, []); console.log('PASS no page runtime errors');
  } finally { if (context) await context.close(); server.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
