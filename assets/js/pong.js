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
let ballTrail = [];
let backgroundOffset = 0;
let scorePopTime = 0;

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

    // Ball movement logic remains unchanged...

    // Update ball trail logic remains unchanged...

    // Ball collision logic remains unchanged...

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

    // Draw center line and paddles remain unchanged...

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