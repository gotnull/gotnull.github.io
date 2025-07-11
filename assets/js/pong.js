const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

const paddleWidth = 10;
const paddleHeight = 100;
const ballSize = 10;

let player1Y = canvas.height / 2 - paddleHeight / 2;
let player2Y = canvas.height / 2 - paddleHeight / 2;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeedX = 5;
let ballSpeedY = 5;

let player1Score = 0;
let player2Score = 0;

let gameRunning = true; // Game starts running by default
let gameMode = 'ai-vs-ai'; // Default mode is AI vs AI

let player2Speed = 0; // Speed for player 2 when user controlled

document.getElementById('startGame').addEventListener('click', () => {
    // If game is already running (AI vs AI), just switch mode and reset
    gameRunning = true;
    player1Score = 0;
    player2Score = 0;
    gameMode = 'player-vs-ai'; // Switch mode when player starts
    console.log('Game mode switched to:', gameMode);
    resetBall();
    // No need to call gameLoop() again if it's already running
});

function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.fill();
}

function resetBall() {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballSpeedX = ballSpeedX > 0 ? -5 : 5; // Ensure ball always serves in opposite direction
    ballSpeedY = (Math.random() * 10) - 5; // Random vertical speed
}

function update() {
    if (!gameRunning) return;

    // AI for player 1 (left paddle) - always AI controlled
    player1Y += (ballY - (player1Y + paddleHeight / 2)) * 0.1;
    player1Y = Math.max(0, Math.min(canvas.height - paddleHeight, player1Y));

    // Move ball
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Ball collision with top/bottom walls
    if (ballY < 0 || ballY > canvas.height - ballSize) {
        ballSpeedY = -ballSpeedY;
    }

    // Ball collision with paddles
    if (ballX < paddleWidth && ballY > player1Y && ballY < player1Y + paddleHeight) {
        ballSpeedX = -ballSpeedX;
        let deltaY = ballY - (player1Y + paddleHeight / 2);
        ballSpeedY = deltaY * 0.35;
    } else if (ballX > canvas.width - paddleWidth - ballSize && ballY > player2Y && ballY < player2Y + paddleHeight) {
        ballSpeedX = -ballSpeedX;
        let deltaY = ballY - (player2Y + paddleHeight / 2);
        ballSpeedY = deltaY * 0.35;
    }

    // Ball out of bounds (scoring)
    if (ballX < 0) {
        player2Score++;
        resetBall();
    } else if (ballX > canvas.width - ballSize) {
        player1Score++;
        resetBall();
    }

    // Player 2 control based on game mode
    if (gameMode === 'ai-vs-ai') {
        // AI for player 2 (right paddle)
        player2Y += (ballY - (player2Y + paddleHeight / 2)) * 0.1;
        player2Y = Math.max(0, Math.min(canvas.height - paddleHeight, player2Y));
    } else if (gameMode === 'player-vs-ai') {
        // Player 2 (right paddle) controlled by user
        player2Y += player2Speed;
        player2Y = Math.max(0, Math.min(canvas.height - paddleHeight, player2Y));
    }
}

function draw() {
    // Background
    drawRect(0, 0, canvas.width, canvas.height, '#000');

    // Paddles
    drawRect(0, player1Y, paddleWidth, paddleHeight, '#FFF');
    drawRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight, '#FFF');

    // Ball
    drawCircle(ballX, ballY, ballSize, '#FFF');

    // Scores
    ctx.font = '30px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText(player1Score, canvas.width / 4, 50);
    ctx.fillText(player2Score, canvas.width * 3 / 4, 50);
}

function gameLoop() {
    update();
    draw();
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

document.addEventListener('keydown', (e) => {
    if (gameMode === 'player-vs-ai') {
        if (e.key === 'ArrowUp') {
            player2Speed = -5; // Move up
        } else if (e.key === 'ArrowDown') {
            player2Speed = 5; // Move down
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        player2Speed = 0; // Stop movement
    }
});

// Initial game start
gameLoop();