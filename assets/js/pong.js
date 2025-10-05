// Improved JavaScript code here
```javascript
// Clean, working Pong implementation
// Focus: Core game mechanics that actually work

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;
const INITIAL_BALL_SPEED = 5;
const WINNING_SCORE = 5;
const AI_DIFFICULTY = 0.12;
const PARTICLE_COUNT = 20; // Number of particles for effects
const PADDLE_INTERPOLATION_SPEED = 0.1; // Interpolation speed for smoother paddle movement

// Game state
let canvas, ctx;
let gameRunning = false;
let gameMode = 'ai-vs-ai';
let player1Y, player2Y;
let player1Score = 0, player2Score = 0;
let ball = { x: 0, y: 0, speedX: 0, speedY: 0 };
let keysPressed = {};
let gameSpeed = 1.0;
let soundEnabled = false;
let showWinScreen = false;
let winner = '';
let countdown = 5;
let particles = [];

// Particle effect class
class Particle {
    constructor(x, y, speedX, speedY) {
        this.x = x;
        this.y = y;
        this.speedX = speedX;
        this.speedY = speedY;
        this.alpha = 1.0;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= 0.05; // Fade out
    }
    draw() {
        if (this.alpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.fillRect(this.x, this.y, 4, 4);
        }
    }
}

// Sound effects (simple beeps using Web Audio API)
let audioContext;
let gainNode;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.1;
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function playBeep(frequency = 440, duration = 100) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const tempGain = audioContext.createGain();

    oscillator.connect(tempGain);
    tempGain.connect(gainNode);

    oscillator.frequency.value = frequency;
    oscillator.type = 'square';

    tempGain.gain.setValueAtTime(1, audioContext.currentTime);
    tempGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

// Canvas utilities
function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scale = Math.min(windowWidth / VIRTUAL_WIDTH, windowHeight / VIRTUAL_HEIGHT) * 0.9;

    canvas.style.width = (VIRTUAL_WIDTH * scale) + 'px';
    canvas.style.height = (VIRTUAL_HEIGHT * scale) + 'px';
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

// Game initialization
function initGame() {
    player1Y = VIRTUAL_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    player2Y = VIRTUAL_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    player1Score = 0;
    player2Score = 0;
    resetBall();
}

function resetBall() {
    ball.x = VIRTUAL_WIDTH / 2;
    ball.y = VIRTUAL_HEIGHT / 2;
    const angle = (Math.random() * Math.PI / 2) - Math.PI / 4; // -45° to 45°
    const direction = Math.random() > 0.5 ? 1 : -1;
    ball.speedX = direction * Math.cos(angle) * INITIAL_BALL_SPEED * gameSpeed;
    ball.speedY = Math.sin(angle) * INITIAL_BALL_SPEED * gameSpeed;
}

// Game logic
function update() {
    if (!gameRunning || showWinScreen) return;

    handleInput();

    // AI for player 1 with smooth interpolation
    const targetY1 = ball.y - PADDLE_HEIGHT / 2;
    player1Y += (targetY1 - player1Y) * PADDLE_INTERPOLATION_SPEED;
    player1Y = clamp(player1Y, 0, VIRTUAL_HEIGHT - PADDLE_HEIGHT);

    // AI for player 2 (or player control) with smooth interpolation
    if (gameMode === 'ai-vs-ai') {
        const targetY2 = ball.y - PADDLE_HEIGHT / 2;
        player2Y += (targetY2 - player2Y) * PADDLE_INTERPOLATION_SPEED;
    }
    player2Y = clamp(player2Y, 0, VIRTUAL_HEIGHT - PADDLE_HEIGHT);

    // Ball movement
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Ball collision with top/bottom walls
    if (ball.y <= 0 || ball.y >= VIRTUAL_HEIGHT - BALL_SIZE) {
        ball.speedY *= -1;
        playBeep(300, 50);
    }

    // Ball collision with paddles
    if (ball.x <= PADDLE_WIDTH &&
        ball.y >= player1Y &&
        ball.y <= player1Y + PADDLE_HEIGHT) {
        ball.speedX = Math.abs(ball.speedX) * 1.05; // Slight speed increase
        ball.speedY += (ball.y - (player1Y + PADDLE_HEIGHT / 2)) * 0.3;
        playBeep(440, 50);
        spawnParticles(ball.x, ball.y);
    } else if (ball.x >= VIRTUAL_WIDTH - PADDLE_WIDTH - BALL_SIZE &&
               ball.y >= player2Y &&
               ball.y <= player2Y + PADDLE_HEIGHT) {
        ball.speedX = -Math.abs(ball.speedX) * 1.05;
        ball.speedY += (ball.y - (player2Y + PADDLE_HEIGHT / 2)) * 0.3;
        playBeep(440, 50);
        spawnParticles(ball.x, ball.y);
    }

    // Scoring
    if (ball.x < 0) {
        player2Score++;
        playBeep(200, 200);
        checkWinCondition();
        if (!showWinScreen) resetBall();
    } else if (ball.x > VIRTUAL_WIDTH) {
        player1Score++;
        playBeep(200, 200);
        checkWinCondition();
        if (!showWinScreen) resetBall();
    }

    // Update particles
    particles.forEach(particle => particle.update());
    particles = particles.filter(particle => particle.alpha > 0);
}

function handleInput() {
    if (gameMode === 'player-vs-ai') {
        if (keysPressed['ArrowUp']) player2Y -= 7 * gameSpeed;
        if (keysPressed['ArrowDown']) player2Y += 7 * gameSpeed;
    } else if (gameMode === 'multiplayer') {
        if (keysPressed['w'] || keysPressed['W']) player1Y -= 7 * gameSpeed;
        if (keysPressed['s'] || keysPressed['S']) player1Y += 7 * gameSpeed;
        if (keysPressed['ArrowUp']) player2Y -= 7 * gameSpeed;
        if (keysPressed['ArrowDown']) player2Y += 7 * gameSpeed;
    }
}

function checkWinCondition() {
    if (player1Score >= WINNING_SCORE || player2Score >= WINNING_SCORE) {
        winner = player1Score >= WINNING_SCORE ? 'Player 1 (Left)' : 'Player 2 (Right)';
        showWinScreen = true;
        gameRunning = false;
        playBeep(600, 500);
        setTimeout(() => {
            countdown = 5;
            const countInterval = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(countInterval);
                    showWinScreen = false;
                    startGame('ai-vs-ai');
                }
            }, 1000);
        }, 1000);
    }
}

function spawnParticles(x, y) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const speedX = (Math.random() - 0.5) * 4;
        const speedY = (Math.random() - 0.5) * 4;
        particles.push(new Particle(x, y, speedX, speedY));
    }
}

// Rendering
function draw() {
    // Clear screen
    drawRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, '#000');

    // Draw center line
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIRTUAL_WIDTH / 2, 0);
    ctx.lineTo(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    drawRect(0, player1Y, PADDLE_WIDTH, PADDLE_HEIGHT, '#FFF');
    drawRect(VIRTUAL_WIDTH - PADDLE_WIDTH, player2Y, PADDLE_WIDTH, PADDLE_HEIGHT, '#FFF');

    // Draw ball
    drawCircle(ball.x, ball.y, BALL_SIZE, '#FFF');

    // Draw scores
    ctx.font = '48px Arial';
    ctx.fillStyle = '#555';
    ctx.fillText(player1Score, VIRTUAL_WIDTH / 4, 60);
    ctx.fillText(player2Score, VIRTUAL_WIDTH * 3 / 4, 60);

    // Draw particles
    particles.forEach(particle => particle.draw());

    // Draw win screen
    if (showWinScreen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        ctx.fillStyle = '#FFF';
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${winner} Wins!`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20);
        ctx.font = '24px Arial';
        ctx.fillText(`Restarting in ${countdown}...`, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 30);
        ctx.textAlign = 'left';
    }
}

function gameLoop() {
    update();
    draw();
    if (gameRunning || showWinScreen) {
        requestAnimationFrame(gameLoop);
    }
}

// Game controls
function startGame(mode) {
    gameMode = mode;
    gameRunning = true;
    showWinScreen = false;
    initGame();
    document.getElementById('gameModeDisplay').innerText =
        `Mode: ${mode.replace('-', ' vs ').toUpperCase()}`;
    gameLoop();
}

function togglePause() {
    if (showWinScreen) return;
    gameRunning = !gameRunning;
    if (gameRunning) gameLoop();
}

function adjustGameSpeed(delta) {
    gameSpeed = clamp(gameSpeed + delta, 0.5, 2.0);
    document.getElementById('speedDisplay').innerText = `Speed: ${gameSpeed.toFixed(1)}x`;
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('toggleSound').innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen().catch(err => console.log(`Fullscreen error: ${err.message}`));
    } else {
        document.exitFullscreen();
    }
}

// Event listeners
function setupEventListeners() {
    document.addEventListener('keydown', (e) => { keysPressed[e.key] = true; });
    document.addEventListener('keyup', (e) => { keysPressed[e.key] = false; });

    document.getElementById('startGame').onclick = () => startGame('player-vs-ai');
    document.getElementById('startAI').onclick = () => startGame('ai-vs-ai');
    document.getElementById('startMultiplayer').onclick = () => startGame('multiplayer');
    document.getElementById('pauseGame').onclick = togglePause;
    document.getElementById('toggleSound').onclick = toggleSound;
    document.getElementById('increaseSpeed').onclick = () => adjustGameSpeed(0.1);
    document.getElementById('decreaseSpeed').onclick = () => adjustGameSpeed(-0.1);
    document.getElementById('fullscreenButton').onclick = toggleFullscreen;

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('pongCanvas');
    ctx = canvas.getContext('2d');

    initAudio();
    setupEventListeners();
    resizeCanvas();
    startGame('ai-vs-ai');
});
```