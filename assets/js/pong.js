// Added feature: New "Invisible Ball" power-up and refactored code for better organization

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

const paddleWidth = 10;
const paddleHeight = 100;
const ballSize = 10;

const soundEffect = new Audio('/assets/audio/bounce.mp3');

let player1Y = canvas.height / 2 - paddleHeight / 2;
let player2Y = canvas.height / 2 - paddleHeight / 2;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
const INITIAL_BALL_SPEED = 5;
let ballSpeedX = INITIAL_BALL_SPEED;
let ballSpeedY = INITIAL_BALL_SPEED;

let ballSpeedMultiplier = 1;

let player1Score = 0;
let player2Score = 0;

let gameRunning = false;
let gameMode = 'ai-vs-ai';

let player2Speed = 0;
let powerUpActive = false;
let powerUpX, powerUpY;
let powerUpVisible = true;

const winningScore = 5;
let showWinScreen = false;
let winner = '';
let countdown = 5;
let countdownInterval;

// New variables for sound effects, themes, power-up types, and new multiplayer feature
const hitSound = new Audio('/assets/audio/hit.mp3');
const winSound = new Audio('/assets/audio/win.mp3');
const themes = ['#007BFF', '#28A745', '#FFC107', '#DC3545'];
let currentTheme = 0;

const powerUpTypes = ['speed', 'shrinkPaddle', 'reverseControls', 'invisibleBall'];
let currentPowerUpType = '';
let ballVisible = true; // New variable to handle invisible ball state

document.getElementById('startGame').addEventListener('click', () => startGame('player-vs-ai'));
document.getElementById('pauseGame').addEventListener('click', togglePause);
document.getElementById('changeTheme').addEventListener('click', changeTheme);
document.getElementById('toggleSound').addEventListener('click', toggleSound);

let soundEnabled = true;

// New feature: Local Storage for saving high scores
let highScores = JSON.parse(localStorage.getItem('highScores')) || { player1: 0, player2: 0 };

function displayHighScores() {
    document.getElementById('highScores').innerText = `High Scores - Player 1: ${highScores.player1}, Player 2: ${highScores.player2}`;
}

function updateHighScores() {
    if (player1Score > highScores.player1) {
        highScores.player1 = player1Score;
    }
    if (player2Score > highScores.player2) {
        highScores.player2 = player2Score;
    }
    localStorage.setItem('highScores', JSON.stringify(highScores));
    displayHighScores();
}

function startGame(mode) {
    showWinScreen = false;
    gameRunning = true;
    player1Score = 0;
    player2Score = 0;
    gameMode = mode;
    document.getElementById('gameModeDisplay').innerText = `Mode: ${mode.replace('-', ' vs ').toUpperCase()}`;
    ballSpeedMultiplier = 1; // Reset multiplier at the start of a new game
    ballVisible = true; // Ensure ball is visible at the start of the game
    resetBall();
    spawnPowerUp();
    gameLoop();
}

function togglePause() {
    if (showWinScreen) return;
    gameRunning = !gameRunning;
    if (gameRunning) {
        gameLoop();
    }
}

function changeTheme() {
    currentTheme = (currentTheme + 1) % themes.length;
    document.documentElement.style.setProperty('--theme-color', themes[currentTheme]);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('toggleSound').innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';
}

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
    ballSpeedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * ballSpeedMultiplier;
    ballSpeedY = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * ballSpeedMultiplier;
}

function spawnPowerUp() {
    powerUpActive = true;
    powerUpVisible = true;
    powerUpX = Math.random() * (canvas.width - 30) + 15;
    powerUpY = Math.random() * (canvas.height - 30) + 15;
    currentPowerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    setTimeout(() => {
        powerUpVisible = false;
        setTimeout(() => powerUpActive = false, 5000);
    }, 10000);
}

function checkPowerUpCollision() {
    const distX = Math.abs(ballX - powerUpX);
    const distY = Math.abs(ballY - powerUpY);
    if (distX < ballSize && distY < ballSize) {
        handlePowerUpEffect();
        powerUpVisible = false;
    }
}

function handlePowerUpEffect() {
    switch (currentPowerUpType) {
        case 'speed':
            ballSpeedMultiplier = 1.5;
            break;
        case 'shrinkPaddle':
            paddleHeight = Math.max(paddleHeight - 20, 40);
            setTimeout(() => {
                paddleHeight = 100; // Reset paddle size after 10 seconds
            }, 10000);
            break;
        case 'reverseControls':
            reverseControls();
            setTimeout(() => {
                reverseControls(); // Revert controls after 10 seconds
            }, 10000);
            break;
        case 'invisibleBall':
            ballVisible = false;
            setTimeout(() => {
                ballVisible = true; // Make the ball visible again after 5 seconds
            }, 5000);
            break;
    }
}

function reverseControls() {
    document.removeEventListener('keydown', controlHandler);
    document.removeEventListener('keyup', controlHandler);
    document.addEventListener('keydown', reverseControlHandler);
    document.addEventListener('keyup', reverseControlHandler);
}

function reverseControlHandler(e) {
    if (gameMode === 'player-vs-ai' || gameMode === 'multiplayer') {
        if (e.type === 'keydown') {
            if (e.key === 'w') player1Y = Math.min(player1Y + 5, canvas.height - paddleHeight);
            if (e.key === 's') player1Y = Math.max(player1Y - 5, 0);
            if (e.key === 'ArrowUp') player2Speed = 5;
            if (e.key === 'ArrowDown') player2Speed = -5;
        } else if (e.type === 'keyup') {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') player2Speed = 0;
        }
    }
}

function controlHandler(e) {
    if (gameMode === 'player-vs-ai') {
        if (e.key === 'ArrowUp') player2Speed = -5;
        else if (e.key === 'ArrowDown') player2Speed = 5;
    } else if (gameMode === 'multiplayer') {
        if (e.key === 'w') player1Y = Math.max(player1Y - 5, 0);
        else if (e.key === 's') player1Y = Math.min(player1Y + 5, canvas.height - paddleHeight);
        if (e.key === 'ArrowUp') player2Speed = -5;
        else if (e.key === 'ArrowDown') player2Speed = 5;
    }
}

function update() {
    if (!gameRunning || showWinScreen) return;

    player1Y += (ballY - (player1Y + paddleHeight / 2)) * 0.1;
    player1Y = Math.max(0, Math.min(canvas.height - paddleHeight, player1Y));

    ballX += ballSpeedX;
    ballY += ballSpeedY;

    if (ballY < 0 || ballY > canvas.height - ballSize) {
        ballSpeedY = -ballSpeedY;
        if (soundEnabled) hitSound.play();
    }

    if (ballX < paddleWidth && ballY > player1Y && ballY < player1Y + paddleHeight) {
        ballSpeedX = -ballSpeedX;
        let deltaY = ballY - (player1Y + paddleHeight / 2);
        ballSpeedY = deltaY * 0.35;
        if (soundEnabled) hitSound.play();
    } else if (ballX > canvas.width - paddleWidth - ballSize && ballY > player2Y && ballY < player2Y + paddleHeight) {
        ballSpeedX = -ballSpeedX;
        let deltaY = ballY - (player2Y + paddleHeight / 2);
        ballSpeedY = deltaY * 0.35;
        if (soundEnabled) hitSound.play();
    }

    if (ballX < 0) {
        player2Score++;
        if (player2Score >= winningScore) {
            winner = 'Player 2';
            showWinScreen = true;
            if (soundEnabled) winSound.play();
            gameRunning = false;
            updateHighScores();
            startCountdown();
        }
        resetBall();
        if (!powerUpActive) spawnPowerUp();
    } else if (ballX > canvas.width - ballSize) {
        player1Score++;
        if (player1Score >= winningScore) {
            winner = 'Player 1';
            showWinScreen = true;
            if (soundEnabled) winSound.play();
            gameRunning = false;
            updateHighScores();
            startCountdown();
        }
        resetBall();
        if (!powerUpActive) spawnPowerUp();
    }

    if (gameMode === 'ai-vs-ai') {
        player2Y += (ballY - (player2Y + paddleHeight / 2)) * 0.1;
        player2Y = Math.max(0, Math.min(canvas.height - paddleHeight, player2Y));
    } else if (gameMode === 'player-vs-ai') {
        player2Y += player2Speed;
        player2Y = Math.max(0, Math.min(canvas.height - paddleHeight, player2Y));
    }

    if (powerUpActive && powerUpVisible) {
        checkPowerUpCollision();
    }
}

function draw() {
    drawRect(0, 0, canvas.width, canvas.height, '#000');
    drawRect(0, player1Y, paddleWidth, paddleHeight, '#FFF');
    drawRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight, '#FFF');
    if (ballVisible) drawCircle(ballX, ballY, ballSize, '#FFF');

    ctx.font = '30px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText(player1Score, canvas.width / 4, 50);
    ctx.fillText(player2Score, canvas.width * 3 / 4, 50);

    ctx.strokeStyle = '#FFF';
    ctx.beginPath();
    ctx.setLineDash([5, 15]);
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    if (powerUpActive && powerUpVisible) {
        drawCircle(powerUpX, powerUpY, 15, getPowerUpColor(currentPowerUpType));
    }

    if (showWinScreen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.fillText(`${winner} Wins!`, canvas.width / 2 - 80, canvas.height / 2);
        ctx.fillText('Game restarts in ' + countdown + '...', canvas.width / 2 - 150, canvas.height / 2 + 50);
    }
}

function getPowerUpColor(type) {
    switch (type) {
        case 'speed': return '#FFD700';
        case 'shrinkPaddle': return '#FF6347';
        case 'reverseControls': return '#8A2BE2';
        case 'invisibleBall': return '#00CED1';
    }
}

function startCountdown() {
    countdown = 5;
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            startGame('ai-vs-ai');
        }
    }, 1000);
}

function gameLoop() {
    update();
    draw();
    if (gameRunning || showWinScreen) {
        requestAnimationFrame(gameLoop);
    }
}

document.addEventListener('keydown', controlHandler);
document.addEventListener('keyup', controlHandler);

// New feature: Display FPS
let lastFrameTime = 0;
function showFPS(time) {
    const delta = time - lastFrameTime;
    lastFrameTime = time;
    const fps = Math.round(1000 / delta);
    ctx.fillStyle = '#FFF';
    ctx.font = '14px Arial';
    ctx.fillText(`FPS: ${fps}`, 10, 20);
    requestAnimationFrame(showFPS);
}
requestAnimationFrame(showFPS);

// New Feature: Game Speed Adjustment
let gameSpeed = 1;
document.getElementById('increaseSpeed').addEventListener('click', () => adjustGameSpeed(0.1));
document.getElementById('decreaseSpeed').addEventListener('click', () => adjustGameSpeed(-0.1));

function adjustGameSpeed(amount) {
    gameSpeed = Math.max(0.5, Math.min(2, gameSpeed + amount));
    ballSpeedX *= (1 + amount);
    ballSpeedY *= (1 + amount);
    player2Speed *= (1 + amount);
}

displayHighScores(); // Display high scores on load
startGame('ai-vs-ai');