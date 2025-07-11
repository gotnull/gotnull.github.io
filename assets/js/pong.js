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

let player1Score = 0;
let player2Score = 0;

let gameRunning = false;
let gameMode = 'ai-vs-ai';

let player2Speed = 0;
let powerUpActive = false;
let powerUpX, powerUpY;

const winningScore = 5;
let showWinScreen = false;
let winner = '';
let countdown = 5;
let countdownInterval;

// New variables for sound effects and themes
const hitSound = new Audio('/assets/audio/hit.mp3');
const winSound = new Audio('/assets/audio/win.mp3');
const themes = ['#007BFF', '#28A745', '#FFC107', '#DC3545'];
let currentTheme = 0;

document.getElementById('startGame').addEventListener('click', () => startGame('player-vs-ai'));
document.getElementById('pauseGame').addEventListener('click', togglePause);
document.getElementById('changeTheme').addEventListener('click', changeTheme);
document.getElementById('toggleSound').addEventListener('click', toggleSound);

let soundEnabled = true;

function startGame(mode) {
    showWinScreen = false;
    gameRunning = true;
    player1Score = 0;
    player2Score = 0;
    gameMode = mode;
    document.getElementById('gameModeDisplay').innerText = `Mode: ${mode.replace('-', ' vs ').toUpperCase()}`;
    ballSpeedX = INITIAL_BALL_SPEED;
    ballSpeedY = INITIAL_BALL_SPEED;
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
    ballSpeedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    ballSpeedY = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
}

function spawnPowerUp() {
    powerUpActive = true;
    powerUpX = Math.random() * (canvas.width - 30) + 15;
    powerUpY = Math.random() * (canvas.height - 30) + 15;
    setTimeout(() => {
        powerUpActive = false;
    }, 10000);
}

function checkPowerUpCollision() {
    const distX = Math.abs(ballX - powerUpX);
    const distY = Math.abs(ballY - powerUpY);
    if (distX < ballSize && distY < ballSize) {
        ballSpeedX *= 1.5;
        ballSpeedY *= 1.5;
        powerUpActive = false;
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

    if (powerUpActive) {
        checkPowerUpCollision();
    }
}

function draw() {
    drawRect(0, 0, canvas.width, canvas.height, '#000');
    drawRect(0, player1Y, paddleWidth, paddleHeight, '#FFF');
    drawRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight, '#FFF');
    drawCircle(ballX, ballY, ballSize, '#FFF');

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

    if (powerUpActive) {
        drawCircle(powerUpX, powerUpY, 15, '#FFD700');
    }

    if (showWinScreen) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.fillText(`${winner} Wins!`, canvas.width / 2 - 80, canvas.height / 2);
        ctx.fillText('Game restarts in ' + countdown + '...', canvas.width / 2 - 150, canvas.height / 2 + 50);
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

document.addEventListener('keydown', (e) => {
    if (gameMode === 'player-vs-ai') {
        if (e.key === 'ArrowUp') {
            player2Speed = -5;
        } else if (e.key === 'ArrowDown') {
            player2Speed = 5;
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        player2Speed = 0;
    }
});

startGame('ai-vs-ai');