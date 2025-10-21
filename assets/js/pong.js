// Improved JavaScript code here

// Adding subtle background animation for a dynamic visual effect

const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;
const INITIAL_BALL_SPEED = 5;
const WINNING_SCORE = 5;
const AI_DIFFICULTY = 0.12;
const PARTICLE_COUNT = 20; // Number of particles for effects
const PADDLE_INTERPOLATION_SPEED = 0.2; // Increased interpolation speed for smoother paddle movement
const TRAIL_LENGTH = 10; // Length of the ball trail
const SCORE_POP_DURATION = 300; // Duration of score pop animation in milliseconds
const SPIN_FACTOR = 0.3; // Factor for ball spin effect
const COLOR_TRANSITION_DURATION = 500; // Duration of color transition in milliseconds

// Game state
let canvas, ctx;
let gameRunning = false;
let gameMode = 'ai-vs-ai';
let player1Y, player2Y;
let player1Score = 0, player2Score = 0;
let ball = { x: 0, y: 0, speedX: 0, speedY: 0, spin: 0 };
let keysPressed = {};
let gameSpeed = 1.0;
let soundEnabled = false;
let showWinScreen = false;
let winner = '';
let countdown = 5;
let particles = [];
let ballTrail = [];
let backgroundOffset = 0;
let scorePopTime = 0;
let paddleHitTime = 0;
let lastHitPaddle = null;

// Particle effect class remains unchanged...

// Sound effects remain unchanged...

// Canvas utilities remain unchanged...

// Game initialization remains unchanged...

// Game logic
function update() {
    if (!gameRunning || showWinScreen) return;

    handleInput();

    // AI movement logic with interpolation
    if (gameMode.includes('ai')) {
        let targetY = ball.y - (PADDLE_HEIGHT / 2);
        player2Y += (targetY - player2Y) * PADDLE_INTERPOLATION_SPEED;
    }

    // Player movement logic remains unchanged...

    ball.x += ball.speedX;
    ball.y += ball.speedY + ball.spin; // Apply spin to ball's vertical movement

    // Ball collision logic with spin effect
    if (ball.y <= 0 || ball.y >= VIRTUAL_HEIGHT - BALL_SIZE) {
        ball.speedY = -ball.speedY;
        ball.spin = -ball.spin; // Reverse spin direction on top/bottom collision
    }

    if (ball.x <= PADDLE_WIDTH) {
        if (ball.y > player1Y && ball.y < player1Y + PADDLE_HEIGHT) {
            ball.speedX = -ball.speedX;
            ball.spin = (ball.y - (player1Y + PADDLE_HEIGHT / 2)) * SPIN_FACTOR;
            triggerPaddleHitEffect('left');
        }
    } else if (ball.x >= VIRTUAL_WIDTH - BALL_SIZE - PADDLE_WIDTH) {
        if (ball.y > player2Y && ball.y < player2Y + PADDLE_HEIGHT) {
            ball.speedX = -ball.speedX;
            ball.spin = (ball.y - (player2Y + PADDLE_HEIGHT / 2)) * SPIN_FACTOR;
            triggerPaddleHitEffect('right');
        }
    }

    // Update ball trail logic remains unchanged...

    // Update particles logic remains unchanged...

    // Background animation update
    backgroundOffset += 0.5;
    if (backgroundOffset > VIRTUAL_HEIGHT) {
        backgroundOffset = 0;
    }

    // Score pop animation timer update
    if (scorePopTime > 0) {
        scorePopTime -= 16; // Assuming ~60 FPS, reduce by frame duration
        if (scorePopTime < 0) scorePopTime = 0;
    }

    // Paddle hit color transition timer update
    if (paddleHitTime > 0) {
        paddleHitTime -= 16;
        if (paddleHitTime < 0) {
            paddleHitTime = 0;
            lastHitPaddle = null;
        }
    }
}

function triggerPaddleHitEffect(paddle) {
    paddleHitTime = COLOR_TRANSITION_DURATION;
    lastHitPaddle = paddle;
}

// handleInput function remains unchanged...

// checkWinCondition function updated to trigger score pop
function checkWinCondition() {
    if (player1Score >= WINNING_SCORE || player2Score >= WINNING_SCORE) {
        showWinScreen = true;
        winner = player1Score >= WINNING_SCORE ? 'Player 1' : 'Player 2';
    } else {
        scorePopTime = SCORE_POP_DURATION; // Trigger score pop animation
    }
}

// spawnParticles function remains unchanged...

// Rendering
function draw() {
    // Clear screen with animated background
    const gradient = ctx.createLinearGradient(0, backgroundOffset, 0, VIRTUAL_HEIGHT + backgroundOffset);
    gradient.addColorStop(0, '#111');
    gradient.addColorStop(1, '#333');
    drawRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, gradient);

    // Draw center line
    drawRect(VIRTUAL_WIDTH / 2 - 1, 0, 2, VIRTUAL_HEIGHT, '#555');

    // Draw paddles with color transition
    let leftPaddleColor = lastHitPaddle === 'left' ? `rgba(255, 165, 0, ${paddleHitTime / COLOR_TRANSITION_DURATION})` : '#fff';
    let rightPaddleColor = lastHitPaddle === 'right' ? `rgba(255, 165, 0, ${paddleHitTime / COLOR_TRANSITION_DURATION})` : '#fff';
    drawRect(0, player1Y, PADDLE_WIDTH, PADDLE_HEIGHT, leftPaddleColor);
    drawRect(VIRTUAL_WIDTH - PADDLE_WIDTH, player2Y, PADDLE_WIDTH, PADDLE_HEIGHT, rightPaddleColor);

    // Draw ball trail and ball remain unchanged...

    // Draw scores with pop effect
    ctx.font = "24px Arial";
    ctx.fillStyle = "#fff";
    let scale = 1 + (scorePopTime / SCORE_POP_DURATION) * 0.5; // Scale factor for pop effect
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

    // Draw particles remain unchanged...

    // Draw win screen remains unchanged...
}

// gameLoop, Game controls, Event listeners, and Initialization remain unchanged...