#!/usr/bin/env node
// Plays the Pong page in headless Chrome and fails if anything is wrong.
//
//   node ghost/pong_check.js [--js assets/js/pong.js] [--html _includes/pong_game_content.html]
//                            [--css assets/css/pong.css] [--libs _data/pong_libs.yml]
//
// What it checks:
//   1. static: the markup has every element id the game needs, the script
//      looks up no id that is missing, the script parses, no eval, no
//      network calls, no script or link tags in the markup, ASCII only,
//      size limits, and every requested library is in the catalogue
//   2. in Chrome: the page loads with no error, window.Pong exists with
//      start, pause, resume, setSpeed, state and step, the game starts in
//      AI vs AI and draws, every button works, keys and touch move the
//      paddles, pause pauses, speed changes and play leaves the setting
//      alone, a point is scored and a game ends and restarts, all without a
//      single page error
//
// Chrome is found from CHROME_PATH, PUPPETEER_EXECUTABLE_PATH, or the usual
// places. The improver runs this before it keeps a change. Exit 0 is a pass.
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const JS = path.resolve(arg('--js', path.join(ROOT, 'assets/js/pong.js')));
const HTML = path.resolve(arg('--html', path.join(ROOT, '_includes/pong_game_content.html')));
const CSS = path.resolve(arg('--css', path.join(ROOT, 'assets/css/pong.css')));
const LIBS = path.resolve(arg('--libs', path.join(ROOT, '_data/pong_libs.yml')));
const CATALOG = path.join(ROOT, '_data/pong_library_catalog.yml');

const REQUIRED_IDS = [
  'pongCanvas', 'startGame', 'startAI', 'startMultiplayer', 'pauseGame',
  'toggleSound', 'fullscreenButton', 'gameModeDisplay', 'decreaseSpeed',
  'speedDisplay', 'increaseSpeed'
];
const MAX_JS_BYTES = 160 * 1024;
const MAX_HTML_BYTES = 24 * 1024;
const MAX_CSS_BYTES = 48 * 1024;

const failures = [];
function fail(message) { failures.push(message); }
function assert(condition, message) { if (!condition) fail(message); }

function finish() {
  if (failures.length) {
    console.error('pong check: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('pong check: PASS');
  process.exit(0);
}

// A small YAML reader for the two flat files this needs: `libs: [a, b]`
// or a `libs:` list, and a catalogue of `name:` blocks with `url:` lines.
function readLibs(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const inline = text.match(/^libs:\s*\[([^\]]*)\]/m);
  if (inline) return inline[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const out = [];
  let inList = false;
  for (const line of text.split('\n')) {
    if (/^libs:\s*$/.test(line)) { inList = true; continue; }
    if (inList) {
      const m = line.match(/^\s*-\s*['"]?([A-Za-z0-9_-]+)['"]?\s*$/);
      if (m) out.push(m[1]); else if (line.trim() && !line.startsWith('#')) break;
    }
  }
  return out;
}

function readCatalog(file) {
  const out = {};
  let current = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const head = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (head) { current = head[1]; out[current] = {}; continue; }
    const kv = current && line.match(/^\s+([a-z]+):\s*(.+?)\s*$/);
    if (kv) out[current][kv[1]] = kv[2];
  }
  return out;
}

const js = fs.readFileSync(JS, 'utf8');
const html = fs.readFileSync(HTML, 'utf8');
const css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';
const libs = readLibs(LIBS);
const catalog = readCatalog(CATALOG);

// 1. Static checks.
assert(Buffer.byteLength(js) <= MAX_JS_BYTES, `pong.js is over ${MAX_JS_BYTES} bytes`);
assert(Buffer.byteLength(html) <= MAX_HTML_BYTES, `markup is over ${MAX_HTML_BYTES} bytes`);
assert(Buffer.byteLength(css) <= MAX_CSS_BYTES, `stylesheet is over ${MAX_CSS_BYTES} bytes`);
assert(!/<script/i.test(html), 'markup must not contain a script tag; libraries go in _data/pong_libs.yml');
assert(!/<link/i.test(html), 'markup must not load stylesheets; the layout loads pong.css');
assert(!/\beval\s*\(/.test(js) && !/new\s+Function\s*\(/.test(js), 'pong.js must not use eval or new Function');
assert(!/document\.write/.test(js), 'pong.js must not use document.write');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|importScripts|EventSource)\b/.test(js), 'pong.js must not talk to the network');
assert(!/\bimport\s*\(|^\s*import\s|^\s*export\s/m.test(js), 'pong.js must be a plain script, not a module');
assert(!/createElement\(\s*['"]script['"]\s*\)/.test(js), 'pong.js must not inject script tags; libraries go in _data/pong_libs.yml');
const opens = (css.match(/{/g) || []).length;
const closes = (css.match(/}/g) || []).length;
assert(opens === closes, `stylesheet braces do not balance (${opens} open, ${closes} close)`);
for (const [name, text] of [['pong.js', js], ['pong.css', css], ['markup', html]]) {
  assert(!/[^\x00-\x7F]/.test(text), `${name} must be ASCII`);
}
for (const lib of libs) assert(catalog[lib] && catalog[lib].url, `library "${lib}" is not in _data/pong_library_catalog.yml`);

const htmlIds = new Set();
for (const m of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) htmlIds.add(m[1]);
for (const id of REQUIRED_IDS) assert(htmlIds.has(id), `markup is missing id="${id}"`);
for (const m of js.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
  assert(htmlIds.has(m[1]), `pong.js looks up id "${m[1]}" which is not in the markup`);
}
assert(/\bwindow\.Pong\b/.test(js), 'pong.js must set window.Pong');
try {
  new vm.Script(js, { filename: 'pong.js' });
} catch (e) {
  fail(`pong.js does not parse: ${e.message}`);
}
if (failures.length) finish();

// 2. The page in Chrome.
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

async function run() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    fail('puppeteer-core is not installed; run: npm install --prefix ghost');
    return;
  }
  const chrome = findChrome();
  if (!chrome) { fail('no Chrome found; set CHROME_PATH'); return; }

  // Serve the repository so /assets/... resolves as it does on the site,
  // with the candidate files at /__check/.
  const libTags = libs.map(l => `<script src="${catalog[l].url}" crossorigin="anonymous"></script>`).join('\n');
  const pageHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>Pong check</title>
<link rel="stylesheet" href="/__check/pong.css"></head>
<body>
${html}
${libTags}
<script src="/__check/pong.js"></script>
</body></html>`;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let body = null, type = 'application/octet-stream';
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (url === '/__check/' || url === '/__check/index.html') { body = pageHtml; type = 'text/html'; }
    else if (url === '/__check/pong.js') { body = js; type = 'text/javascript'; }
    else if (url === '/__check/pong.css') { body = css; type = 'text/css'; }
    else {
      const file = path.join(ROOT, url);
      if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        body = fs.readFileSync(file);
        type = types[path.extname(file)] || type;
      }
    }
    if (body === null) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', '--window-size=1000,800', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800 });
    page.on('pageerror', e => errors.push('page error: ' + (e.message || String(e))));
    page.on('console', msg => { if (msg.type() === 'error') { const loc = msg.location && msg.location(); errors.push('console error: ' + msg.text() + (loc && loc.url ? ' (' + loc.url + ')' : '')); } });
    page.on('requestfailed', req => errors.push('request failed: ' + req.url()));
    await page.goto(origin + '/__check/', { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));

    const api = await page.evaluate(() => {
      const P = window.Pong;
      if (!P || typeof P !== 'object') return null;
      return ['start', 'pause', 'resume', 'setSpeed', 'state', 'step'].filter(n => typeof P[n] !== 'function');
    });
    assert(api !== null, 'window.Pong is not set after load');
    if (api === null) return;
    assert(api.length === 0, `window.Pong is missing: ${api.join(', ')}`);
    if (api.length) return;

    for (const lib of libs) {
      const g = catalog[lib].global;
      if (g) {
        const present = await page.evaluate(name => typeof window[name] !== 'undefined', g);
        assert(present, `library "${lib}" did not load (window.${g} is undefined)`);
      }
    }

    const s0 = await page.evaluate(() => window.Pong.state());
    assert(s0 && s0.ball && typeof s0.ball.x === 'number', 'state().ball.x is not a number');
    assert(s0 && s0.scores && typeof s0.scores.left === 'number' && typeof s0.scores.right === 'number', 'state().scores are not numbers');
    assert(s0 && s0.mode === 'ai-vs-ai', `game should start in ai-vs-ai, got ${s0 && s0.mode}`);
    assert(s0 && s0.running === true, 'game should be running after load');
    if (failures.length) return;

    // The loop draws on its own; give it a moment and see that it did.
    await new Promise(r => setTimeout(r, 700));
    const s1 = await page.evaluate(() => window.Pong.state());
    assert(s1.frame > s0.frame, 'the game loop is not advancing frames on its own');
    assert(s1.ball.x !== s0.ball.x || s1.ball.y !== s0.ball.y, 'the ball did not move');
    const drew = await page.evaluate(() => {
      const c = document.getElementById('pongCanvas');
      if (!c) return false;
      try {
        const ctx = c.getContext('2d');
        if (ctx) {
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < d.length; i += 4 * 97) if (d[i] || d[i + 1] || d[i + 2]) return true;
          return false;
        }
      } catch (e) { /* a WebGL canvas: fall through */ }
      return true;
    });
    assert(drew, 'nothing was drawn on the canvas');

    // Buttons.
    const modeButtons = { startGame: 'player-vs-ai', startAI: 'ai-vs-ai', startMultiplayer: 'player-vs-player' };
    for (const [id, mode] of Object.entries(modeButtons)) {
      await page.click('#' + id);
      await page.evaluate(() => window.Pong.step(30));
      const s = await page.evaluate(() => window.Pong.state());
      assert(s.mode === mode, `clicking ${id} should start ${mode}, got ${s.mode}`);
      assert(s.running, `game not running after ${id}`);
      const text = await page.$eval('#gameModeDisplay', el => el.textContent.trim());
      assert(text.length > 0, `gameModeDisplay is empty after ${id}`);
    }

    // Keys in multiplayer.
    await page.click('#startMultiplayer');
    await page.evaluate(() => window.Pong.step(5));
    let before = await page.evaluate(() => window.Pong.state().paddles);
    await page.keyboard.down('w');
    await page.keyboard.down('ArrowDown');
    await page.evaluate(() => window.Pong.step(20));
    await page.keyboard.up('w');
    await page.keyboard.up('ArrowDown');
    let after = await page.evaluate(() => window.Pong.state().paddles);
    assert(after.left < before.left, 'W did not move the left paddle up in multiplayer');
    assert(after.right > before.right, 'ArrowDown did not move the right paddle down in multiplayer');

    // Touch on the right half.
    const box = await page.$eval('#pongCanvas', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.click('#startMultiplayer');
    await page.evaluate(() => window.Pong.step(5));
    before = await page.evaluate(() => window.Pong.state().paddles);
    const tx = box.x + box.w * 0.9, ty = box.y + box.h * 0.05;
    await page.touchscreen.touchStart(tx, ty);
    await page.touchscreen.touchMove(tx, ty);
    await page.evaluate(() => window.Pong.step(40));
    await page.touchscreen.touchEnd();
    after = await page.evaluate(() => window.Pong.state().paddles);
    assert(after.right < before.right, 'dragging on the right half did not move the right paddle up');

    // Pause.
    await page.click('#pauseGame');
    const paused = await page.evaluate(() => { const s = window.Pong.state(); window.Pong.step(30); return [s, window.Pong.state()]; });
    assert(paused[0].paused === true, 'pause button did not pause');
    assert(paused[1].ball.x === paused[0].ball.x && paused[1].ball.y === paused[0].ball.y, 'the ball moved while paused');
    await page.click('#pauseGame');
    assert((await page.evaluate(() => window.Pong.state().paused)) === false, 'pause button did not resume');

    // Speed.
    const sp0 = await page.evaluate(() => window.Pong.state().speed);
    await page.click('#increaseSpeed');
    assert((await page.evaluate(() => window.Pong.state().speed)) > sp0, 'Faster did not raise the speed');
    await page.click('#decreaseSpeed'); await page.click('#decreaseSpeed');
    assert((await page.evaluate(() => window.Pong.state().speed)) < sp0, 'Slower did not lower the speed');
    for (let i = 0; i < 40; i++) await page.click('#increaseSpeed');
    assert((await page.evaluate(() => window.Pong.state().speed)) <= 4, 'speed has no upper limit');
    for (let i = 0; i < 40; i++) await page.click('#decreaseSpeed');
    assert((await page.evaluate(() => window.Pong.state().speed)) > 0, 'speed can reach zero');
    await page.evaluate(() => window.Pong.setSpeed(1));
    // The setting belongs to the player: play may slow or speed the ball for
    // effect, but state().speed must be what the buttons left it at.
    const kept = await page.evaluate(() => {
      const P = window.Pong;
      P.start('ai-vs-ai'); P.setSpeed(1.5);
      const set = P.state().speed;
      P.step(3000);
      return [set, P.state().speed];
    });
    assert(kept[0] === kept[1], `play changed the speed setting from ${kept[0]} to ${kept[1]}`);
    await page.evaluate(() => window.Pong.setSpeed(1));

    // Sound and fullscreen must not throw.
    await page.click('#toggleSound'); await page.click('#toggleSound'); await page.click('#fullscreenButton');
    await new Promise(r => setTimeout(r, 200));

    // Points and a finished game in AI vs AI.
    await page.click('#startAI');
    const scored = await page.evaluate(() => {
      window.Pong.setSpeed(2);
      for (let i = 0; i < 120; i++) {
        window.Pong.step(60);
        const s = window.Pong.state();
        if (s.scores.left + s.scores.right > 0 || s.winner) return true;
      }
      return false;
    });
    assert(scored, 'no point was scored in 7200 ticks of ai-vs-ai at speed 2; is the ball stuck?');
    const ended = await page.evaluate(() => {
      for (let i = 0; i < 600; i++) {
        window.Pong.step(60);
        if (window.Pong.state().winner) return true;
      }
      return false;
    });
    assert(ended, 'no game ended in 36000 ticks of ai-vs-ai at speed 2');
    await page.keyboard.press('Space');
    await page.evaluate(() => window.Pong.step(5));
    const restarted = await page.evaluate(() => window.Pong.state());
    assert(!restarted.winner && restarted.scores.left + restarted.scores.right === 0, 'space after a win did not start a new game');

    // The API directly.
    const apiOk = await page.evaluate(() => {
      const P = window.Pong;
      P.start('player-vs-ai'); P.step(5);
      const a = P.state().mode === 'player-vs-ai';
      P.pause(); const b = P.state().paused === true;
      P.resume(); const c = P.state().paused === false;
      P.start('nonsense'); const d = ['player-vs-ai', 'ai-vs-ai', 'player-vs-player'].includes(P.state().mode);
      P.setSpeed(1); P.start('ai-vs-ai'); P.step(600);
      return { a, b, c, d };
    });
    assert(apiOk.a, 'Pong.start did not set the mode');
    assert(apiOk.b, 'Pong.pause did not pause');
    assert(apiOk.c, 'Pong.resume did not resume');
    assert(apiOk.d, 'Pong.start accepted an unknown mode');

    // Let it draw a little more after all that, then look for errors.
    await new Promise(r => setTimeout(r, 500));
  } finally {
    await browser.close();
    server.close();
  }
  for (const e of errors) fail(e);
}

run().then(finish, e => { fail('the check itself failed: ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e)); finish(); });
