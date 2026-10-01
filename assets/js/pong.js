// Pong. Maintained by the program that writes this site; each accepted
// change is recorded in the ledger. ghost/pong_check.js loads this file
// together with _includes/pong_game_content.html in a fake browser and
// plays a few thousand frames before any change is published. It expects:
//   - every element id listed in ELEMENT_IDS to exist in the markup
//   - window.Pong with start(mode), pause(), resume(), setSpeed(n), state()
//   - a point to be scored within a few thousand frames of AI vs AI
// Keep those and the page cannot break.
(function () {
  'use strict';

  var WIDTH = 800;
  var HEIGHT = 400;
  var PADDLE_WIDTH = 10;
  var PADDLE_HEIGHT = 100;
  var BALL_SIZE = 10;
  var BALL_SPEED = 5;
  var PADDLE_SPEED = 7;
  var AI_MAX_SPEED = 5.2;
  var AI_REACTION_DISTANCE = 300;
  var WINNING_SCORE = 5;
  var RESTART_SECONDS = 5;
  var TRAIL_LENGTH = 10;
  var SCORE_POP_FRAMES = 20;
  var SHAKE_FRAMES = 12;
  var FLASH_FRAMES = 18;
  var MIN_SPEED = 0.5;
  var MAX_SPEED = 3;
  var SPEED_STEP = 0.25;
  var FRAME_MS = 1000 / 60;

  var MODES = {
    'player-vs-ai': 'Player vs AI',
    'ai-vs-ai': 'AI vs AI',
    'player-vs-player': 'Multiplayer'
  };

  var ELEMENT_IDS = [
    'pongCanvas', 'startGame', 'startAI', 'startMultiplayer', 'pauseGame',
    'toggleSound', 'fullscreenButton', 'gameModeDisplay', 'decreaseSpeed',
    'speedDisplay', 'increaseSpeed'
  ];

  var el = {};
  var ctx = null;
  var state = {
    mode: 'ai-vs-ai',
    running: false,
    paused: false,
    speed: 1,
    sound: false,
    left: { y: 0, score: 0, flash: 0, target: null },
    right: { y: 0, score: 0, flash: 0, target: null },
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    winner: null,
    restartAt: 0,
    frame: 0
  };
  var keys = {};
  var trail = [];
  var particles = [];
  var scorePop = 0;
  var shake = 0;
  var sounds = {};
  var lastTime = 0;
  var accumulator = 0;

  function byId(id) {
    return (typeof document !== 'undefined' && document.getElementById) ? document.getElementById(id) : null;
  }

  function setText(node, text) {
    if (node) node.textContent = text;
  }

  function clamp(value, low, high) {
    return value < low ? low : (value > high ? high : value);
  }

  // Sound. Files live in assets/audio. A missing file or a browser that
  // refuses autoplay must never stop the game, so every call is guarded.
  function loadSounds() {
    if (typeof Audio === 'undefined') return;
    var names = { bounce: 'bounce', hit: 'hit', win: 'win' };
    Object.keys(names).forEach(function (key) {
      try {
        sounds[key] = new Audio('/assets/audio/' + names[key] + '.mp3');
        sounds[key].preload = 'auto';
      } catch (e) {
        sounds[key] = null;
      }
    });
  }

  function play(name) {
    if (!state.sound || !sounds[name]) return;
    try {
      sounds[name].currentTime = 0;
      var p = sounds[name].play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {
      // Autoplay policy or a missing file. Ignore.
    }
  }

  // Game state.
  function resetBall(direction) {
    var b = state.ball;
    b.x = WIDTH / 2 - BALL_SIZE / 2;
    b.y = HEIGHT / 2 - BALL_SIZE / 2;
    var angle = (Math.random() - 0.5) * (Math.PI / 2);
    b.vx = Math.cos(angle) * BALL_SPEED * (direction || (Math.random() < 0.5 ? -1 : 1));
    b.vy = Math.sin(angle) * BALL_SPEED;
    trail = [];
  }

  function start(mode) {
    if (!MODES[mode]) mode = 'ai-vs-ai';
    state.mode = mode;
    state.running = true;
    state.paused = false;
    state.winner = null;
    state.restartAt = 0;
    state.left.score = 0;
    state.right.score = 0;
    state.left.y = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    state.right.y = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    state.left.target = null;
    state.right.target = null;
    particles = [];
    resetBall();
    setText(el.gameModeDisplay, 'Mode: ' + MODES[mode]);
    setText(el.pauseGame, 'Pause');
    ['startGame', 'startAI', 'startMultiplayer'].forEach(function (id) {
      if (el[id] && el[id].classList) el[id].classList.remove('active');
    });
    var active = { 'player-vs-ai': 'startGame', 'ai-vs-ai': 'startAI', 'player-vs-player': 'startMultiplayer' }[mode];
    if (el[active] && el[active].classList) el[active].classList.add('active');
  }

  function pause() {
    if (!state.running || state.winner) return;
    state.paused = true;
    setText(el.pauseGame, 'Resume');
  }

  function resume() {
    state.paused = false;
    setText(el.pauseGame, 'Pause');
  }

  function togglePause() {
    if (state.paused) resume(); else pause();
  }

  function setSpeed(value) {
    state.speed = clamp(Math.round(value / SPEED_STEP) * SPEED_STEP, MIN_SPEED, MAX_SPEED);
    setText(el.speedDisplay, 'Speed: ' + state.speed.toFixed(state.speed % 1 === 0 ? 1 : 2) + 'x');
  }

  function setSound(on) {
    state.sound = !!on;
    setText(el.toggleSound, 'Sound: ' + (state.sound ? 'On' : 'Off'));
  }

  function humanControls(side) {
    if (state.mode === 'player-vs-player') return true;
    if (state.mode === 'player-vs-ai') return side === 'right';
    return false;
  }

  function movePaddle(paddle, dy) {
    paddle.y = clamp(paddle.y + dy, 0, HEIGHT - PADDLE_HEIGHT);
  }

  function steerHuman(side, paddle, upKeys, downKeys) {
    var dy = 0;
    if (upKeys.some(function (k) { return keys[k]; })) dy -= PADDLE_SPEED;
    if (downKeys.some(function (k) { return keys[k]; })) dy += PADDLE_SPEED;
    if (paddle.target !== null) {
      var diff = paddle.target - (paddle.y + PADDLE_HEIGHT / 2);
      dy = clamp(diff, -PADDLE_SPEED * 2, PADDLE_SPEED * 2);
    }
    movePaddle(paddle, dy);
  }

  // The AI follows the ball only while it is approaching and within reach,
  // and cannot move faster than AI_MAX_SPEED, so it misses now and then.
  function steerAi(side, paddle) {
    var b = state.ball;
    var approaching = side === 'left' ? b.vx < 0 : b.vx > 0;
    var distance = side === 'left' ? b.x : WIDTH - b.x;
    var target = HEIGHT / 2;
    if (approaching && distance < AI_REACTION_DISTANCE) {
      target = b.y + BALL_SIZE / 2;
    }
    var diff = target - (paddle.y + PADDLE_HEIGHT / 2);
    movePaddle(paddle, clamp(diff * 0.2, -AI_MAX_SPEED, AI_MAX_SPEED));
  }

  function spawnParticles(x, y, colour) {
    for (var i = 0; i < 16; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 24,
        colour: colour
      });
    }
  }

  function bounceOff(paddle, side) {
    var b = state.ball;
    var centre = paddle.y + PADDLE_HEIGHT / 2;
    var offset = clamp((b.y + BALL_SIZE / 2 - centre) / (PADDLE_HEIGHT / 2), -1, 1);
    var angle = offset * (Math.PI / 3);
    var speed = Math.min(Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 1.04, BALL_SPEED * 2.4);
    var direction = side === 'left' ? 1 : -1;
    b.vx = Math.cos(angle) * speed * direction;
    b.vy = Math.sin(angle) * speed;
    b.x = side === 'left' ? PADDLE_WIDTH : WIDTH - PADDLE_WIDTH - BALL_SIZE;
    paddle.flash = FLASH_FRAMES;
    spawnParticles(b.x + BALL_SIZE / 2, b.y + BALL_SIZE / 2, '#ffa500');
    play('hit');
  }

  function score(side) {
    state[side].score += 1;
    scorePop = SCORE_POP_FRAMES;
    shake = SHAKE_FRAMES;
    spawnParticles(state.ball.x, state.ball.y, '#ffffff');
    if (state[side].score >= WINNING_SCORE) {
      state.winner = side;
      state.restartAt = state.frame + RESTART_SECONDS * 60;
      play('win');
    } else {
      play('bounce');
    }
    resetBall(side === 'left' ? 1 : -1);
  }

  function step() {
    state.frame += 1;
    if (!state.running) return;

    if (state.winner) {
      if (state.restartAt && state.frame >= state.restartAt) start('ai-vs-ai');
      return;
    }
    if (state.paused) return;

    if (humanControls('left')) steerHuman('left', state.left, ['w', 'W'], ['s', 'S']);
    else steerAi('left', state.left);
    if (humanControls('right')) steerHuman('right', state.right, ['ArrowUp'], ['ArrowDown']);
    else steerAi('right', state.right);

    var b = state.ball;
    b.x += b.vx * state.speed;
    b.y += b.vy * state.speed;

    if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); play('bounce'); }
    if (b.y >= HEIGHT - BALL_SIZE) { b.y = HEIGHT - BALL_SIZE; b.vy = -Math.abs(b.vy); play('bounce'); }

    if (b.vx < 0 && b.x <= PADDLE_WIDTH && b.x + BALL_SIZE >= 0 &&
        b.y + BALL_SIZE >= state.left.y && b.y <= state.left.y + PADDLE_HEIGHT) {
      bounceOff(state.left, 'left');
    } else if (b.vx > 0 && b.x + BALL_SIZE >= WIDTH - PADDLE_WIDTH && b.x <= WIDTH &&
        b.y + BALL_SIZE >= state.right.y && b.y <= state.right.y + PADDLE_HEIGHT) {
      bounceOff(state.right, 'right');
    }

    if (b.x + BALL_SIZE < 0) score('right');
    else if (b.x > WIDTH) score('left');

    trail.push({ x: b.x, y: b.y });
    if (trail.length > TRAIL_LENGTH) trail.shift();

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 1;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (scorePop > 0) scorePop -= 1;
    if (shake > 0) shake -= 1;
    if (state.left.flash > 0) state.left.flash -= 1;
    if (state.right.flash > 0) state.right.flash -= 1;
  }

  // Drawing.
  function rect(x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  function paddleColour(paddle) {
    if (paddle.flash <= 0) return '#ffffff';
    return 'rgba(255,165,0,' + (0.4 + 0.6 * paddle.flash / FLASH_FRAMES).toFixed(2) + ')';
  }

  function draw() {
    if (!ctx) return;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }
    var gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#111111');
    gradient.addColorStop(1, '#2c2c2c');
    rect(-10, -10, WIDTH + 20, HEIGHT + 20, gradient);

    for (var y = 0; y < HEIGHT; y += 24) rect(WIDTH / 2 - 1, y, 2, 12, '#555555');

    rect(0, state.left.y, PADDLE_WIDTH, PADDLE_HEIGHT, paddleColour(state.left));
    rect(WIDTH - PADDLE_WIDTH, state.right.y, PADDLE_WIDTH, PADDLE_HEIGHT, paddleColour(state.right));

    for (var i = 0; i < trail.length; i++) {
      rect(trail[i].x, trail[i].y, BALL_SIZE, BALL_SIZE, 'rgba(255,255,255,' + (i / trail.length * 0.5).toFixed(2) + ')');
    }
    rect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE, '#ffffff');

    for (var j = 0; j < particles.length; j++) {
      var p = particles[j];
      ctx.fillStyle = p.colour;
      ctx.globalAlpha = p.life / 24;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    var scale = 1 + (scorePop / SCORE_POP_FRAMES) * 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px "Open Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.save();
    ctx.translate(WIDTH / 4, 20);
    ctx.scale(scale, scale);
    ctx.fillText(String(state.left.score), 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(WIDTH * 3 / 4, 20);
    ctx.scale(scale, scale);
    ctx.fillText(String(state.right.score), 0, 0);
    ctx.restore();

    ctx.font = '14px "Open Sans", Arial, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(MODES[state.mode], WIDTH / 2, HEIGHT - 24);

    if (state.winner) {
      var name = state.winner === 'left'
        ? (humanControls('left') ? 'Player 1' : 'Left AI')
        : (humanControls('right') ? (state.mode === 'player-vs-player' ? 'Player 2' : 'You') : 'Right AI');
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.font = '40px "Open Sans", Arial, sans-serif';
      ctx.fillText(name + ' wins', WIDTH / 2, HEIGHT / 2 - 24);
      ctx.font = '18px "Open Sans", Arial, sans-serif';
      var left = Math.max(0, Math.ceil((state.restartAt - state.frame) / 60));
      ctx.fillText('Space to play again. AI vs AI in ' + left + 's', WIDTH / 2, HEIGHT / 2 + 24);
    } else if (state.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.font = '40px "Open Sans", Arial, sans-serif';
      ctx.fillText('Paused', WIDTH / 2, HEIGHT / 2);
    }
    ctx.restore();
  }

  // Loop. Fixed 60 Hz simulation steps, however fast the display runs.
  function frame(now) {
    if (typeof now !== 'number') now = lastTime + FRAME_MS;
    if (!lastTime) lastTime = now;
    accumulator += Math.min(now - lastTime, 250);
    lastTime = now;
    var guard = 0;
    while (accumulator >= FRAME_MS && guard < 10) {
      step();
      accumulator -= FRAME_MS;
      guard += 1;
    }
    if (guard === 10) accumulator = 0;
    draw();
    requestAnimationFrame(frame);
  }

  // Input.
  function canvasY(event) {
    var box = el.pongCanvas.getBoundingClientRect ? el.pongCanvas.getBoundingClientRect() : { top: 0, height: HEIGHT, left: 0, width: WIDTH };
    var point = (event.touches && event.touches[0]) || event;
    return {
      x: (point.clientX - box.left) / (box.width || WIDTH) * WIDTH,
      y: (point.clientY - box.top) / (box.height || HEIGHT) * HEIGHT
    };
  }

  function onPointer(event) {
    if (!state.running || state.winner) return;
    var p = canvasY(event);
    var side = p.x < WIDTH / 2 ? 'left' : 'right';
    if (state.mode === 'player-vs-ai') side = 'right';
    if (!humanControls(side)) return;
    state[side].target = p.y;
    if (event.preventDefault) event.preventDefault();
  }

  function onPointerEnd() {
    state.left.target = null;
    state.right.target = null;
  }

  function onKeyDown(event) {
    var key = event.key;
    if (key === undefined) return;
    keys[key] = true;
    if (key === ' ' || key === 'Spacebar') {
      if (state.winner) start(state.mode);
      if (event.preventDefault) event.preventDefault();
    }
    if (key === 'p' || key === 'P') togglePause();
    if ((key === 'ArrowUp' || key === 'ArrowDown') && event.preventDefault && state.running) event.preventDefault();
  }

  function onKeyUp(event) {
    if (event.key !== undefined) delete keys[event.key];
  }

  function fullscreen() {
    var c = el.pongCanvas;
    if (!c) return;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      } else if (c.requestFullscreen) {
        var p = c.requestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    } catch (e) {
      // Not available. Ignore.
    }
  }

  function on(node, type, handler) {
    if (node && node.addEventListener) node.addEventListener(type, handler, { passive: false });
  }

  function init() {
    ELEMENT_IDS.forEach(function (id) { el[id] = byId(id); });
    if (!el.pongCanvas || !el.pongCanvas.getContext) return;
    ctx = el.pongCanvas.getContext('2d');
    if (!ctx) return;
    el.pongCanvas.width = WIDTH;
    el.pongCanvas.height = HEIGHT;

    loadSounds();
    setSound(false);
    setSpeed(1);

    on(el.startGame, 'click', function () { start('player-vs-ai'); });
    on(el.startAI, 'click', function () { start('ai-vs-ai'); });
    on(el.startMultiplayer, 'click', function () { start('player-vs-player'); });
    on(el.pauseGame, 'click', togglePause);
    on(el.toggleSound, 'click', function () { setSound(!state.sound); });
    on(el.fullscreenButton, 'click', fullscreen);
    on(el.decreaseSpeed, 'click', function () { setSpeed(state.speed - SPEED_STEP); });
    on(el.increaseSpeed, 'click', function () { setSpeed(state.speed + SPEED_STEP); });

    on(document, 'keydown', onKeyDown);
    on(document, 'keyup', onKeyUp);
    on(el.pongCanvas, 'mousedown', onPointer);
    on(el.pongCanvas, 'mousemove', function (e) { if (e.buttons) onPointer(e); });
    on(el.pongCanvas, 'mouseup', onPointerEnd);
    on(el.pongCanvas, 'mouseleave', onPointerEnd);
    on(el.pongCanvas, 'touchstart', onPointer);
    on(el.pongCanvas, 'touchmove', onPointer);
    on(el.pongCanvas, 'touchend', onPointerEnd);
    on(el.pongCanvas, 'touchcancel', onPointerEnd);

    start('ai-vs-ai');
    requestAnimationFrame(frame);
  }

  var api = {
    start: start,
    pause: pause,
    resume: resume,
    setSpeed: setSpeed,
    state: function () {
      return {
        mode: state.mode,
        running: state.running,
        paused: state.paused,
        speed: state.speed,
        sound: state.sound,
        winner: state.winner,
        frame: state.frame,
        ball: { x: state.ball.x, y: state.ball.y, vx: state.ball.vx, vy: state.ball.vy },
        scores: { left: state.left.score, right: state.right.score },
        paddles: { left: state.left.y, right: state.right.y }
      };
    }
  };
  if (typeof window !== 'undefined') window.Pong = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
