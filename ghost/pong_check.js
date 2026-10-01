#!/usr/bin/env node
// Plays the Pong page in a fake browser and fails if anything is wrong.
//
//   node ghost/pong_check.js [--js assets/js/pong.js] [--html _includes/pong_game_content.html] [--css assets/css/pong.css]
//
// What it checks:
//   1. the markup has every element id the script lists in ELEMENT_IDS,
//      and every id the script looks up exists in the markup
//   2. the script parses and runs without throwing, through load, a few
//      thousand frames, every button, the keyboard and the touch handlers
//   3. window.Pong exists with start, pause, resume, setSpeed and state
//   4. the ball moves, each mode starts, pause pauses, speed changes
//   5. in AI vs AI a point is scored within a few thousand frames, so the
//      ball cannot be stuck
//
// The improver runs this before it keeps a change. Exit code 0 is a pass.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const JS = arg('--js', path.join(ROOT, 'assets/js/pong.js'));
const HTML = arg('--html', path.join(ROOT, '_includes/pong_game_content.html'));
const CSS = arg('--css', path.join(ROOT, 'assets/css/pong.css'));

const REQUIRED_IDS = [
  'pongCanvas', 'startGame', 'startAI', 'startMultiplayer', 'pauseGame',
  'toggleSound', 'fullscreenButton', 'gameModeDisplay', 'decreaseSpeed',
  'speedDisplay', 'increaseSpeed'
];
const MAX_JS_BYTES = 80 * 1024;
const MAX_HTML_BYTES = 16 * 1024;
const MAX_CSS_BYTES = 32 * 1024;

const failures = [];
function fail(message) { failures.push(message); }
function assert(condition, message) { if (!condition) fail(message); }

const js = fs.readFileSync(JS, 'utf8');
const html = fs.readFileSync(HTML, 'utf8');
const css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';

// 1. Static checks on the three files.
assert(Buffer.byteLength(js) <= MAX_JS_BYTES, `pong.js is over ${MAX_JS_BYTES} bytes`);
assert(Buffer.byteLength(html) <= MAX_HTML_BYTES, `markup is over ${MAX_HTML_BYTES} bytes`);
assert(Buffer.byteLength(css) <= MAX_CSS_BYTES, `stylesheet is over ${MAX_CSS_BYTES} bytes`);
assert(!/<script/i.test(html), 'markup must not contain a script tag; the layout loads pong.js');
assert(!/<link/i.test(html), 'markup must not load stylesheets; the layout loads pong.css');
assert(!/\beval\s*\(/.test(js) && !/new\s+Function\s*\(/.test(js), 'pong.js must not use eval or new Function');
assert(!/document\.write/.test(js), 'pong.js must not use document.write');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|importScripts)\b/.test(js), 'pong.js must not talk to the network');
assert(!/\bimport\s*\(|^\s*import\s|^\s*export\s/m.test(js), 'pong.js must be a plain script, not a module');
const opens = (css.match(/{/g) || []).length;
const closes = (css.match(/}/g) || []).length;
assert(opens === closes, `stylesheet braces do not balance (${opens} open, ${closes} close)`);
assert(!/[^\x00-\x7F]/.test(js), 'pong.js must be ASCII');
assert(!/[^\x00-\x7F]/.test(css), 'pong.css must be ASCII');
assert(!/[^\x00-\x7F]/.test(html), 'markup must be ASCII');

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

// 2. A fake browser: enough DOM for the game, nothing more.
let seed = 123456789;
function random() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

const ctxCalls = {};
function makeContext() {
  const methods = ['fillRect', 'clearRect', 'strokeRect', 'fillText', 'strokeText', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'fill', 'stroke', 'save', 'restore', 'translate', 'scale',
    'rotate', 'setTransform', 'resetTransform', 'clip', 'drawImage', 'quadraticCurveTo', 'bezierCurveTo',
    'ellipse', 'roundRect', 'setLineDash', 'measureText', 'createPattern', 'putImageData', 'getImageData'];
  const ctx = {};
  for (const name of methods) {
    ctx[name] = function () { ctxCalls[name] = (ctxCalls[name] || 0) + 1; return name === 'measureText' ? { width: 10 } : undefined; };
  }
  ctx.createLinearGradient = ctx.createRadialGradient = function () { return { addColorStop() {} }; };
  ctx.canvas = null;
  return ctx;
}

function makeClassList() {
  const set = new Set();
  return {
    add(...c) { c.forEach(x => set.add(x)); },
    remove(...c) { c.forEach(x => set.delete(x)); },
    toggle(c, force) { const on = force === undefined ? !set.has(c) : !!force; on ? set.add(c) : set.delete(c); return on; },
    contains(c) { return set.has(c); }
  };
}

function makeElement(id, tag) {
  const listeners = {};
  const node = {
    id, tagName: (tag || 'div').toUpperCase(), style: {}, classList: makeClassList(), children: [],
    textContent: '', innerText: '', innerHTML: '', disabled: false, width: 0, height: 0,
    clientWidth: 800, clientHeight: 400, offsetWidth: 800, offsetHeight: 400, dataset: {}, parentNode: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
    dispatch(type, event) {
      const ev = Object.assign({ type, target: node, preventDefault() {}, stopPropagation() {} }, event || {});
      for (const fn of listeners[type] || []) fn.call(node, ev);
      if (type === 'click' && typeof node.onclick === 'function') node.onclick(ev);
      return ev;
    },
    listenerCount(type) { return (listeners[type] || []).length; },
    appendChild(child) { node.children.push(child); child.parentNode = node; return child; },
    removeChild(child) { node.children = node.children.filter(c => c !== child); return child; },
    insertBefore(child) { node.children.unshift(child); return child; },
    setAttribute(name, value) { node[name] = value; },
    getAttribute(name) { return node[name] === undefined ? null : node[name]; },
    removeAttribute(name) { delete node[name]; },
    focus() {}, blur() {}, click() { node.dispatch('click'); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getContext(kind) { return kind === '2d' ? makeContext() : null; },
    requestFullscreen() { return Promise.resolve(); },
    toDataURL() { return ''; }
  };
  return node;
}

const elements = new Map();
for (const id of htmlIds) {
  elements.set(id, makeElement(id, id === 'pongCanvas' ? 'canvas' : (id.startsWith('start') || id.endsWith('Speed') || /Button|Game|Sound/.test(id) ? 'button' : 'span')));
}

const rafQueue = [];
let now = 0;
const documentNode = makeElement('document', 'document');
documentNode.body = makeElement('body', 'body');
documentNode.documentElement = makeElement('html', 'html');
documentNode.head = makeElement('head', 'head');
documentNode.readyState = 'loading';
documentNode.fullscreenElement = null;
documentNode.exitFullscreen = () => Promise.resolve();
documentNode.hidden = false;
documentNode.visibilityState = 'visible';
documentNode.getElementById = id => elements.get(id) || null;
documentNode.querySelector = sel => (sel && sel[0] === '#' ? elements.get(sel.slice(1)) || null : null);
documentNode.querySelectorAll = () => [];
documentNode.createElement = tag => makeElement('', tag);
documentNode.createTextNode = text => ({ textContent: text });

function Audio(src) { this.src = src; this.currentTime = 0; this.volume = 1; this.preload = ''; this.loop = false; }
Audio.prototype.play = function () { return Promise.resolve(); };
Audio.prototype.pause = function () {};
Audio.prototype.load = function () {};
Audio.prototype.addEventListener = function () {};

const storage = {};
const localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; }
};

const windowListeners = {};
const sandbox = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  document: documentNode,
  navigator: { userAgent: 'pong-check', maxTouchPoints: 1, vibrate() { return false; } },
  localStorage, sessionStorage: localStorage,
  Audio,
  Image: function () {},
  performance: { now: () => now },
  requestAnimationFrame(cb) { rafQueue.push(cb); return rafQueue.length; },
  cancelAnimationFrame() {},
  setTimeout(cb) { rafQueue.push(cb); return 0; },
  clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
  addEventListener(type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn); },
  removeEventListener() {},
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
  getComputedStyle() { return { getPropertyValue() { return ''; } }; },
  AudioContext: undefined,
  Math: Object.assign(Object.create(Math), { random }),
  Date, JSON, Promise, Object, Array, Number, String, Boolean, Error, TypeError, RangeError, Map, Set, Symbol,
  parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, undefined
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function run(label, fn) {
  try {
    fn();
  } catch (e) {
    fail(`${label}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
  }
}

function frames(n) {
  for (let i = 0; i < n; i++) {
    now += 1000 / 60;
    const queue = rafQueue.splice(0, rafQueue.length);
    if (queue.length === 0 && i === 0) fail('nothing is scheduled with requestAnimationFrame; the game loop is not running');
    for (const cb of queue) cb(now);
  }
}

run('loading pong.js', () => vm.runInContext(js, sandbox, { filename: 'pong.js' }));
run('DOMContentLoaded', () => {
  documentNode.readyState = 'interactive';
  documentNode.dispatch('DOMContentLoaded');
  documentNode.readyState = 'complete';
  for (const fn of windowListeners.load || []) fn({ type: 'load' });
  for (const fn of windowListeners.DOMContentLoaded || []) fn({ type: 'DOMContentLoaded' });
});
if (failures.length) finish();

const Pong = sandbox.Pong;
assert(Pong && typeof Pong === 'object', 'window.Pong is not set after load');
if (!Pong) finish();
for (const name of ['start', 'pause', 'resume', 'setSpeed', 'state']) {
  assert(typeof Pong[name] === 'function', `window.Pong.${name} is not a function`);
}
if (failures.length) finish();

// 3. Play.
run('first frames', () => frames(5));
let s0;
run('state()', () => { s0 = Pong.state(); });
assert(s0 && s0.ball && typeof s0.ball.x === 'number', 'state().ball.x is not a number');
assert(s0 && s0.scores && typeof s0.scores.left === 'number' && typeof s0.scores.right === 'number', 'state().scores.left/right are not numbers');
assert(s0 && typeof s0.mode === 'string', 'state().mode is not a string');
assert(s0 && s0.mode === 'ai-vs-ai', `game should start in ai-vs-ai, got ${s0 && s0.mode}`);
assert(s0 && s0.running === true, 'game should be running after load');
if (failures.length) finish();

run('300 frames', () => frames(300));
const s1 = Pong.state();
assert(s1.ball.x !== s0.ball.x || s1.ball.y !== s0.ball.y, 'the ball did not move in 300 frames');
assert((ctxCalls.fillRect || 0) > 0, 'nothing was drawn on the canvas');
assert(!elements.get('pongCanvas') || elements.get('pongCanvas').listenerCount('touchstart') > 0 || elements.get('pongCanvas').listenerCount('pointerdown') > 0, 'the canvas has no touch or pointer handler');

const modeButtons = { startGame: 'player-vs-ai', startAI: 'ai-vs-ai', startMultiplayer: 'player-vs-player' };
for (const [id, mode] of Object.entries(modeButtons)) {
  run(`click ${id}`, () => { elements.get(id).dispatch('click'); frames(30); });
  assert(Pong.state().mode === mode, `clicking ${id} should start ${mode}, got ${Pong.state().mode}`);
  assert(Pong.state().running, `game not running after ${id}`);
  const text = elements.get('gameModeDisplay').textContent;
  assert(typeof text === 'string' && text.length > 0, `gameModeDisplay is empty after ${id}`);
}

run('keys in multiplayer', () => {
  const before = Pong.state().paddles;
  documentNode.dispatch('keydown', { key: 'w' });
  documentNode.dispatch('keydown', { key: 'ArrowDown' });
  frames(20);
  documentNode.dispatch('keyup', { key: 'w' });
  documentNode.dispatch('keyup', { key: 'ArrowDown' });
  const after = Pong.state().paddles;
  assert(after.left < before.left, 'W did not move the left paddle up in multiplayer');
  assert(after.right > before.right, 'ArrowDown did not move the right paddle down in multiplayer');
});

run('touch', () => {
  const canvas = elements.get('pongCanvas');
  canvas.dispatch('touchstart', { touches: [{ clientX: 700, clientY: 10 }], clientX: 700, clientY: 10 });
  canvas.dispatch('touchmove', { touches: [{ clientX: 700, clientY: 10 }], clientX: 700, clientY: 10 });
  frames(40);
  canvas.dispatch('touchend', { touches: [] });
  assert(Pong.state().paddles.right < 100, 'dragging on the right half did not move the right paddle up');
});

run('pause button', () => {
  elements.get('pauseGame').dispatch('click');
  const paused = Pong.state();
  frames(30);
  const later = Pong.state();
  assert(paused.paused === true, 'pause button did not pause');
  assert(later.ball.x === paused.ball.x && later.ball.y === paused.ball.y, 'the ball moved while paused');
  elements.get('pauseGame').dispatch('click');
  frames(5);
  assert(Pong.state().paused === false, 'pause button did not resume');
});

run('speed buttons', () => {
  const start = Pong.state().speed;
  elements.get('increaseSpeed').dispatch('click');
  assert(Pong.state().speed > start, 'Faster did not raise the speed');
  elements.get('decreaseSpeed').dispatch('click');
  elements.get('decreaseSpeed').dispatch('click');
  assert(Pong.state().speed < start, 'Slower did not lower the speed');
  for (let i = 0; i < 40; i++) elements.get('increaseSpeed').dispatch('click');
  assert(Pong.state().speed <= 4, 'speed has no upper limit');
  for (let i = 0; i < 40; i++) elements.get('decreaseSpeed').dispatch('click');
  assert(Pong.state().speed > 0, 'speed can reach zero');
  Pong.setSpeed(1);
  assert(Math.abs(Pong.state().speed - 1) < 1e-9, 'setSpeed(1) did not set speed 1');
});

run('sound and fullscreen buttons', () => {
  elements.get('toggleSound').dispatch('click');
  elements.get('toggleSound').dispatch('click');
  elements.get('fullscreenButton').dispatch('click');
  frames(5);
});

run('points get scored in ai-vs-ai', () => {
  elements.get('startAI').dispatch('click');
  Pong.setSpeed(2);
  let scored = false;
  for (let i = 0; i < 120 && !scored; i++) {
    frames(60);
    const s = Pong.state();
    scored = s.scores.left + s.scores.right > 0 || s.winner;
  }
  assert(scored, 'no point was scored in 7200 frames of ai-vs-ai at speed 2; is the ball stuck?');
});

run('a game ends and restarts', () => {
  let ended = false;
  for (let i = 0; i < 600 && !ended; i++) {
    frames(60);
    ended = !!Pong.state().winner;
  }
  assert(ended, 'no game ended in 36000 frames of ai-vs-ai at speed 2');
  documentNode.dispatch('keydown', { key: ' ' });
  documentNode.dispatch('keyup', { key: ' ' });
  frames(5);
  const s = Pong.state();
  assert(!s.winner && s.scores.left + s.scores.right === 0, 'space after a win did not start a new game');
  Pong.setSpeed(1);
});

run('api start and pause', () => {
  Pong.start('player-vs-ai');
  frames(5);
  assert(Pong.state().mode === 'player-vs-ai', 'Pong.start did not set the mode');
  Pong.pause();
  assert(Pong.state().paused === true, 'Pong.pause did not pause');
  Pong.resume();
  assert(Pong.state().paused === false, 'Pong.resume did not resume');
  Pong.start('nonsense');
  assert(['player-vs-ai', 'ai-vs-ai', 'player-vs-player'].includes(Pong.state().mode), 'Pong.start accepted an unknown mode');
  Pong.start('ai-vs-ai');
  frames(600);
});

finish();

function finish() {
  if (failures.length) {
    console.error('pong check: FAIL');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('pong check: PASS');
  process.exit(0);
}
