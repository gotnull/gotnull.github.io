// Improved Pong Game with Effects and Fixes

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;
const INITIAL_BALL_SPEED = 5;
const WINNING_SCORE = 5;
const AI_DIFFICULTY = 0.12;
const PARTICLE_COUNT = 20;
const PADDLE_INTERPOLATION_SPEED = 0.2;
const TRAIL_LENGTH = 10;
const SCORE_POP_DURATION = 300;
const SPIN_FACTOR = 0.3;
const COLOR_TRANSITION_DURATION = 500;
const SCREEN_SHAKE_DURATION = 20;
const SCREEN_SHAKE_INTENSITY = 5;

// Game state
let canvas, ctx;
let gameRunning = false;
let gameMode = 'ai-vs-ai'; // Options: 'player-vs-ai', 'ai-vs-ai', 'player-vs-player'
let player1Y, player2Y;
let player1Score = 0, player2Score = 0;
let ball = { x: 0, y: 0, speedX: 0, speedY: 0, spin: 0 };
let keysPressed = {};
let showWinScreen = false;
let winner = '';
let particles = [];
let ballTrail = [];
let backgroundOffset = 0;
let scorePopTime = 0;
let paddleHitTime = 0;
let lastHitPaddle = null;
let screenShakeTime = 0;

// Utility
function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

// Particles
function spawnParticles(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x,
            y,
            speedX: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 4,
            life: 30,
            color
        });
    }
}

// Handle player input
function handleInput() {
    const speed = 8;

    // Player 1
    if (gameMode !== 'ai-vs-ai') {
        if (keysPressed['w'] || keysPressed['ArrowUp']) player1Y -= speed;
        if (keysPressed['s'] || keysPressed['ArrowDown']) player1Y += speed;
        player1Y = Math.max(0, Math.min(VIRTUAL_HEIGHT - PADDLE_HEIGHT, player1Y));
    }

    // Player 2 (manual control in player-vs-player mode)
    if (gameMode === 'player-vs-player') {
        if (keysPressed['ArrowUp']) player2Y -= speed;
        if (keysPressed['ArrowDown']) player2Y += speed;
        player2Y = Math.max(0, Math.min(VIRTUAL_HEIGHT - PADDLE_HEIGHT, player2Y));
    }
}

function triggerPaddleHitEffect(paddle) {
    paddleHitTime = COLOR_TRANSITION_DURATION;
    lastHitPaddle = paddle;
    spawnParticles(ball.x, ball.y, 'orange');
}

function resetBall() {
    ball.x = VIRTUAL_WIDTH / 2 - BALL_SIZE / 2;
    ball.y = VIRTUAL_HEIGHT / 2 - BALL_SIZE / 2;
    ball.speedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    ball.speedY = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    ball.spin = 0;
    ballTrail = [];
}

function checkWinCondition() {
    if (player1Score >= WINNING_SCORE || player2Score >= WINNING_SCORE) {
        showWinScreen = true;
        winner = player1Score >= WINNING_SCORE ? 'Player 1' : 'Player 2';
    } else {
        scorePopTime = SCORE_POP_DURATION;
        screenShakeTime = SCREEN_SHAKE_DURATION;
    }
}

// Game logic
function update() {
    if (!gameRunning || showWinScreen) return;

    handleInput();

    // AI movement logic
    if (gameMode.includes('ai')) {
        let targetY = ball.y - PADDLE_HEIGHT / 2;
        player2Y += (targetY - player2Y) * PADDLE_INTERPOLATION_SPEED;
    }

    if (gameMode === 'ai-vs-ai') {
        let targetY1 = ball.y - PADDLE_HEIGHT / 2;
        player1Y += (targetY1 - player1Y) * PADDLE_INTERPOLATION_SPEED * AI_DIFFICULTY * 10;
    }

    // Ball physics
    ball.x += ball.speedX;
    ball.y += ball.speedY + ball.spin;

    // Wall collision
    if (ball.y <= 0 || ball.y >= VIRTUAL_HEIGHT - BALL_SIZE) {
        ball.speedY = -ball.speedY;
        ball.spin = -ball.spin;
    }

    // Left paddle collision
    if (ball.x <= PADDLE_WIDTH) {
        if (ball.y > player1Y && ball.y < player1Y + PADDLE_HEIGHT) {
            ball.speedX = -ball.speedX;
            ball.spin = (ball.y - (player1Y + PADDLE_HEIGHT / 2)) * SPIN_FACTOR;
            triggerPaddleHitEffect('left');
        }
    } else if (ball.x >= VIRTUAL_WIDTH - BALL_SIZE - PADDLE_WIDTH) {
        // Right paddle collision
        if (ball.y > player2Y && ball.y < player2Y + PADDLE_HEIGHT) {
            ball.speedX = -ball.speedX;
            ball.spin = (ball.y - (player2Y + PADDLE_HEIGHT / 2)) * SPIN_FACTOR;
            triggerPaddleHitEffect('right');
        } else if (ball.x >= VIRTUAL_WIDTH - BALL_SIZE) {
            player1Score++;
            resetBall();
            checkWinCondition();
        }
    }

    // Ball goes out left
    if (ball.x <= 0) {
        player2Score++;
        resetBall();
        checkWinCondition();
    }

    // Ball trail update
    ballTrail.push({ x: ball.x, y: ball.y });
    if (ballTrail.length > TRAIL_LENGTH) ballTrail.shift();

    // Particle updates
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Animated background
    backgroundOffset += 0.5;
    if (backgroundOffset > VIRTUAL_HEIGHT) backgroundOffset = 0;

    // Timers
    if (scorePopTime > 0) scorePopTime -= 16;
    if (paddleHitTime > 0) {
        paddleHitTime -= 16;
        if (paddleHitTime < 0) {
            paddleHitTime = 0;
            lastHitPaddle = null;
        }
    }
    if (screenShakeTime > 0) screenShakeTime--;
}

// Draw
function draw() {
    if (!ctx) return;

    // Screen shake
    if (screenShakeTime > 0) {
        const shakeX = (Math.random() * 2 - 1) * SCREEN_SHAKE_INTENSITY;
        const shakeY = (Math.random() * 2 - 1) * SCREEN_SHAKE_INTENSITY;
        ctx.translate(shakeX, shakeY);
    }

    // Background gradient
    const gradient = ctx.createLinearGradient(0, backgroundOffset, 0, VIRTUAL_HEIGHT + backgroundOffset);
    gradient.addColorStop(0, '#111');
    gradient.addColorStop(1, '#333');
    drawRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, gradient);

    // Center line
    drawRect(VIRTUAL_WIDTH / 2 - 1, 0, 2, VIRTUAL_HEIGHT, '#555');

    // Paddles
    let leftColor = lastHitPaddle === 'left'
        ? `rgba(255,165,0,${paddleHitTime / COLOR_TRANSITION_DURATION})`
        : '#fff';
    let rightColor = lastHitPaddle === 'right'
        ? `rgba(255,165,0,${paddleHitTime / COLOR_TRANSITION_DURATION})`
        : '#fff';

    drawRect(0, player1Y, PADDLE_WIDTH, PADDLE_HEIGHT, leftColor);
    drawRect(VIRTUAL_WIDTH - PADDLE_WIDTH, player2Y, PADDLE_WIDTH, PADDLE_HEIGHT, rightColor);

    // Ball trail
    for (let i = 0; i < ballTrail.length; i++) {
        let opacity = i / ballTrail.length;
        drawRect(ballTrail[i].x, ballTrail[i].y, BALL_SIZE, BALL_SIZE, `rgba(255,255,255,${opacity})`);
    }

    // Ball
    drawRect(ball.x, ball.y, BALL_SIZE, BALL_SIZE, '#fff');

    // Scores with pop
    ctx.font = "24px Arial";
    ctx.fillStyle = "#fff";
    let scale = 1 + (scorePopTime / SCORE_POP_DURATION) * 0.5;

    ctx.save();
    ctx.translate(VIRTUAL_WIDTH / 4, 50);
    ctx.scale(scale, scale);
    ctx.fillText(player1Score, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate((VIRTUAL_WIDTH / 4) * 3, 50);
    ctx.scale(scale, scale);
    ctx.fillText(player2Score, 0, 0);
    ctx.restore();

    // Particles
    for (let p of particles) {
        drawCircle(p.x, p.y, 2, p.color);
    }

    // Win screen
    if (showWinScreen) {
        ctx.font = "36px Arial";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${winner} Wins!`, VIRTUAL_WIDTH / 2 - 100, VIRTUAL_HEIGHT / 2);
        ctx.font = "18px Arial";
        ctx.fillText("Press Space to Restart", VIRTUAL_WIDTH / 2 - 100, VIRTUAL_HEIGHT / 2 + 40);
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Setup
window.onload = function () {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;

    player1Y = player2Y = VIRTUAL_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    resetBall();
    gameRunning = true;

    gameLoop();
};

// Input events
document.addEventListener('keydown', e => {
    keysPressed[e.key] = true;
    if (showWinScreen && e.key === ' ') {
        player1Score = 0;
        player2Score = 0;
        showWinScreen = false;
        winner = '';
        resetBall();
    }
});

document.addEventListener('keyup', e => delete keysPressed[e.key]);
