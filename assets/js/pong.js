// Improved JavaScript code here

// Constants
const paddleWidth = 10;
const INITIAL_PADDLE_HEIGHT = 100;
const INITIAL_BALL_SPEED = 5;
const ballSize = 10;
const winningScore = 5;
const powerUpTypes = ['speed', 'shrinkPaddle', 'reverseControls', 'invisibleBall', 'multiball', 'extraLife'];
const themes = ['#000', '#1a1a1a', '#333'];
const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 400;

// Game variables
let paddleHeight;
let ballSpeedMultiplier;
let gameSpeed;
let player1Y, player2Y, player2Speed;
let player1Score, player2Score;
let powerUpActive, powerUpVisible;
let powerUpX, powerUpY, currentPowerUpType, powerUpTimer;
let ballVisible, controlsReversed;
let balls = [];
let gameMode;
let gameRunning = false;
let showWinScreen = false;
let winner = '';
let countdown = 5;
let soundEnabled = false;
let aiDifficulty = 0.15;
let powerUpsEnabled = true;
let currentTheme = 0;
let highScores = JSON.parse(localStorage.getItem('highScores')) || { player1: 0, player2: 0 };
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
let nightModeEnabled = false;
let chatTimestamps = {};
let ably, channel, animationFrameId, countdownInterval, currentUsername;
let pauseCountdown = 0;
let keysPressed = {};
let isMusicPlaying = false;
const backgroundMusic = new Audio('/assets/audio/background.mp3');
backgroundMusic.loop = true;
const hitSound = new Audio('/assets/audio/hit.mp3');
const winSound = new Audio('/assets/audio/win.mp3');
const countdownSound = new Audio('/assets/audio/bounce.mp3');

// New feature: power-up history display
let powerUpHistory = [];
let lastFrameTime = 0;
let fps = 0;

// New feature: Power-up stacking
let activePowerUps = {};

// Helper Functions
function generateRandomUsername() {
    const adjectives = ["Swift", "Brave", "Clever", "Daring", "Eager", "Fierce", "Grand", "Humble", "Jolly", "Keen"];
    const nouns = ["Panda", "Tiger", "Eagle", "Shark", "Wolf", "Lion", "Bear", "Fox", "Hawk", "Owl"];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 100)}`;
}

function resizeCanvas() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scale = Math.min(windowWidth / VIRTUAL_WIDTH, windowHeight / VIRTUAL_HEIGHT);

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

function calculateFPS(timestamp) {
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    fps = Math.round(1000 / delta);
}

function drawFPS() {
    ctx.fillStyle = '#FFF';
    ctx.font = '14px Arial';
    ctx.fillText(`FPS: ${fps}`, 10, 20);
}

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(input));
    return div.innerHTML;
}

// UI Binding and Event Handlers
function bindUI() {
    document.getElementById('startGame').onclick = () => startGame('player-vs-ai');
    document.getElementById('startAI').onclick = () => startGame('ai-vs-ai');
    document.getElementById('startMultiplayer').onclick = () => startGame('multiplayer');
    document.getElementById('pauseGame').onclick = togglePause;
    document.getElementById('changeTheme').onclick = changeTheme;
    document.getElementById('toggleSound').onclick = toggleSound;
    document.getElementById('increaseSpeed').onclick = () => adjustGameSpeed(0.1);
    document.getElementById('decreaseSpeed').onclick = () => adjustGameSpeed(-0.1);
    document.getElementById('resetHighScores').onclick = resetHighScores;
    document.getElementById('instructionsButton').onclick = toggleInstructions;
    document.getElementById('difficultyLevel').onchange = adjustAIDifficulty;
    document.getElementById('fullscreenButton').onclick = toggleFullscreen;
    document.getElementById('togglePowerUps').onclick = togglePowerUps;
    document.getElementById('startOnlineMultiplayer').onclick = startOnlineMultiplayer;
    document.getElementById('sendMessage').onclick = sendMessage;
    document.getElementById('toggleMusic').onclick = toggleMusic;
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('toggleDarkMode').onclick = toggleDarkMode;
    document.getElementById('toggleNightMode').onclick = toggleNightMode;
    document.getElementById('pauseCountdown').onclick = togglePauseCountdown;
}

// Game Initialization and Logic
function initializeGame() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (countdownInterval) clearInterval(countdownInterval);

    paddleHeight = INITIAL_PADDLE_HEIGHT;
    ballSpeedMultiplier = 1;
    gameSpeed = 1;
    resetPaddlePosition();
    player1Score = 0;
    player2Score = 0;
    powerUpActive = false;
    powerUpVisible = false;
    ballVisible = true;
    controlsReversed = false;
    balls = [];
    powerUpHistory = [];
    activePowerUps = {};

    updateSpeedDisplay();
    displayHighScores();
    updateLeaderboardDisplay();
    displayPowerUpHistory();
    resizeCanvas();
}

function startGame(mode) {
    initializeGame();
    gameMode = mode;
    gameRunning = true;
    showWinScreen = false;
    document.getElementById('gameModeDisplay').innerText = `Mode: ${mode.replace('-', ' vs ').toUpperCase()}`;
    balls = [createBall()];
    resetBall(balls[0]);
    if (powerUpsEnabled) spawnPowerUp();
    gameLoop();
}

function gameLoop(timestamp) {
    animationFrameId = requestAnimationFrame(gameLoop);
    calculateFPS(timestamp);
    update();
    draw();
}

function togglePause() {
    if (showWinScreen) return;
    gameRunning = !gameRunning;
    if (gameRunning) gameLoop();
}

function createBall() {
    return { x: canvas.width / 2, y: canvas.height / 2, speedX: 0, speedY: 0 };
}

function resetBall(ball) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * gameSpeed;
    ball.speedY = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * gameSpeed;
}

function resetPaddlePosition() {
    player1Y = canvas.height / 2 - paddleHeight / 2;
    player2Y = canvas.height / 2 - paddleHeight / 2;
}

function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    document.getElementById('toggleDarkMode').innerText = isDarkMode ? 'Light Mode' : 'Dark Mode';
    const themeColor = isDarkMode ? '#222' : '#FFF';
    canvas.style.backgroundColor = themeColor;
}

function toggleNightMode() {
    nightModeEnabled = !nightModeEnabled;
    document.getElementById('toggleNightMode').innerText = nightModeEnabled ? 'Night Mode: On' : 'Night Mode: Off';
}

function displayPowerUpHistory() {
    const historyElement = document.getElementById('powerUpHistory');
    historyElement.innerHTML = '<strong>Recent Power-Ups:</strong> ';
    powerUpHistory.slice(0, 5).forEach(type => {
        const color = getPowerUpColor(type);
        historyElement.innerHTML += `<span class="power-up-history" style="color: ${color};">${type}</span> `;
    });
}

function togglePauseCountdown() {
    pauseCountdown = pauseCountdown > 0 ? 0 : 5;
    const countdownInterval = setInterval(() => {
        if (pauseCountdown > 0) {
            pauseCountdown--;
        } else {
            clearInterval(countdownInterval);
            togglePause();
        }
    }, 1000);
}

// Event Listeners
window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('pongCanvas');
    ctx = canvas.getContext('2d');

    ably = new Ably.Realtime("iS2_UQ.Yk8bNA:gWf506yEprURhapCNSjwxZTt-_Gh4CX-zr5TyyGMLgg");
    channel = ably.channels.get('pong-game');

    currentUsername = generateRandomUsername();

    channel.subscribe('chat', (message) => {
        handleAblyMessage(message.data);
    });

    loadChatHistory();

    bindUI();
    resetEventListeners();
    initializeGame();
    toggleSound();
    startGame('ai-vs-ai');
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

function handleAblyMessage(message) {
    switch (message.type) {
        case 'chat':
            displayChatMessage(message.username, message.content, message.timestamp);
            break;
    }
}

function resetEventListeners() {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e) { keysPressed[e.key] = true; }
function handleKeyUp(e) { keysPressed[e.key] = false; }

function update() {
    if (!gameRunning || showWinScreen) return;

    handleInput();

    if (balls.length) {
        const ball = balls[0];
        player1Y += (ball.y - (player1Y + paddleHeight / 2)) * aiDifficulty;
        player1Y = clamp(player1Y, 0, canvas.height - paddleHeight);
    }

    if (gameMode === 'ai-vs-ai' && balls.length) {
        const ball = balls[0];
        player2Y += (ball.y - (player2Y + paddleHeight / 2)) * aiDifficulty;
    } else {
        player2Y += player2Speed;
    }

    player2Y = clamp(player2Y, 0, canvas.height - paddleHeight);

    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        if (ball.y <= 0 || ball.y >= canvas.height - ballSize) {
            ball.speedY *= -1;
            if (soundEnabled) hitSound.play();
        }

        if (ball.x <= paddleWidth && ball.y >= player1Y && ball.y <= player1Y + paddleHeight) {
            ball.speedX = Math.abs(ball.speedX);
            ball.speedY = (ball.y - (player1Y + paddleHeight / 2)) * 0.35;
            if (soundEnabled) hitSound.play();
        } else if (ball.x >= canvas.width - paddleWidth - ballSize && ball.y >= player2Y && ball.y <= player2Y + paddleHeight) {
            ball.speedX = -Math.abs(ball.speedX);
            ball.speedY = (ball.y - (player2Y + paddleHeight / 2)) * 0.35;
            if (soundEnabled) hitSound.play();
        }

        if (powerUpActive && powerUpVisible) {
            const dx = Math.abs(ball.x - powerUpX);
            const dy = Math.abs(ball.y - powerUpY);
            if (dx < ballSize && dy < ballSize) {
                handlePowerUpEffect();
                powerUpVisible = false;
                powerUpActive = false;
            }
        }

        if (ball.x < 0) {
            player2Score++;
            balls.splice(i, 1);
            checkWinCondition();
        } else if (ball.x > canvas.width) {
            player1Score++;
            balls.splice(i, 1);
            checkWinCondition();
        }
    }

    if (balls.length === 0 && !showWinScreen) {
        let b = createBall();
        resetBall(b);
        balls.push(b);
        if (powerUpsEnabled && !powerUpActive) spawnPowerUp();
    }

    if (powerUpActive && powerUpTimer > 0) powerUpTimer -= 1 / 60;

    // Handle active power-up effects
    handleActivePowerUps();
}

function handleInput() {
    if (gameMode === 'player-vs-ai') {
        player2Speed = keysPressed['ArrowUp'] ? (controlsReversed ? 5 : -5)
            : keysPressed['ArrowDown'] ? (controlsReversed ? -5 : 5) : 0;
    } else if (gameMode === 'multiplayer') {
        if (keysPressed['w'] || keysPressed['W']) player1Y -= (controlsReversed ? -5 : 5);
        if (keysPressed['s'] || keysPressed['S']) player1Y += (controlsReversed ? -5 : 5);

        player2Speed = keysPressed['ArrowUp'] ? (controlsReversed ? 5 : -5)
            : keysPressed['ArrowDown'] ? (controlsReversed ? -5 : 5) : 0;

        player1Y = clamp(player1Y, 0, canvas.height - paddleHeight);
    }
}

function draw() {
    drawRect(0, 0, canvas.width, canvas.height, nightModeEnabled ? 'rgba(0, 0, 0, 0.8)' : '#000');

    drawRect(0, player1Y, paddleWidth, paddleHeight, '#FFF');
    drawRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight, '#FFF');

    balls.forEach(ball => {
        if (ballVisible) drawCircle(ball.x, ball.y, ballSize, '#FFF');
    });

    ctx.setLineDash([5, 15]);
    ctx.strokeStyle = '#FFF';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '30px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText(player1Score, canvas.width / 4, 50);
    ctx.fillText(player2Score, canvas.width * 3 / 4, 50);

    if (powerUpActive && powerUpVisible) {
        drawCircle(powerUpX, powerUpY, 15, getPowerUpColor(currentPowerUpType));
    }

    if (powerUpActive) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px Arial';
        ctx.fillText(`Power-Up: ${currentPowerUpType.toUpperCase()} (${powerUpTimer.toFixed(1)}s)`, 10, canvas.height - 20);
    }

    if (showWinScreen) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '30px Arial';
        ctx.fillText(`${winner} Wins!`, canvas.width / 2 - 80, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText(`Game restarts in ${countdown}...`, canvas.width / 2 - 120, canvas.height / 2 + 50);
    }

    drawFPS();
    drawPowerUpHistory();

    if (pauseCountdown > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '30px Arial';
        ctx.fillText(`Resuming in ${pauseCountdown}...`, canvas.width / 2 - 120, canvas.height / 2);
    }
}

function spawnPowerUp() {
    if (!powerUpsEnabled) return;
    powerUpActive = true;
    powerUpVisible = true;
    powerUpX = Math.random() * (canvas.width - 30) + 15;
    powerUpY = Math.random() * (canvas.height - 30) + 15;
    currentPowerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    powerUpTimer = currentPowerUpType === 'invisibleBall' ? 5 : 10;

    setTimeout(() => {
        powerUpVisible = false;
        setTimeout(() => {
            powerUpActive = false;
        }, 5000);
    }, powerUpTimer * 1000);
}

function handlePowerUpEffect() {
    powerUpHistory.unshift(currentPowerUpType);
    if (powerUpHistory.length > 5) powerUpHistory.pop();
    displayPowerUpHistory();

    switch (currentPowerUpType) {
        case 'speed':
            stackablePowerUp('speed', 1.5, 10000);
            break;
        case 'shrinkPaddle':
            stackablePowerUp('shrinkPaddle', -20, 10000, true);
            break;
        case 'reverseControls':
            stackablePowerUp('reverseControls', null, 10000);
            controlsReversed = true;
            break;
        case 'invisibleBall':
            stackablePowerUp('invisibleBall', null, 5000);
            ballVisible = false;
            break;
        case 'multiball':
            addAdditionalBalls();
            break;
        case 'extraLife':
            player1Score++;
            break;
    }
}

function stackablePowerUp(type, effect, duration, isPaddle) {
    if (!activePowerUps[type]) {
        activePowerUps[type] = { effect: effect, duration: duration, timer: duration };
        if (type === 'speed') {
            balls.forEach(ball => {
                ball.speedX *= effect;
                ball.speedY *= effect;
            });
        } else if (isPaddle && type === 'shrinkPaddle') {
            paddleHeight = Math.max(paddleHeight + effect, 40);
        }
    } else {
        activePowerUps[type].timer += duration;
    }
}

function handleActivePowerUps() {
    Object.keys(activePowerUps).forEach(type => {
        const powerUp = activePowerUps[type];
        powerUp.timer -= 1 / 60;
        if (powerUp.timer <= 0) {
            if (type === 'speed') {
                balls.forEach(ball => {
                    ball.speedX /= powerUp.effect;
                    ball.speedY /= powerUp.effect;
                });
            } else if (type === 'shrinkPaddle') {
                paddleHeight = INITIAL_PADDLE_HEIGHT;
            } else if (type === 'reverseControls') {
                controlsReversed = false;
            } else if (type === 'invisibleBall') {
                ballVisible = true;
            }
            delete activePowerUps[type];
        }
    });
}

function addAdditionalBalls() {
    while (balls.length < 3) {
        let newBall = createBall();
        resetBall(newBall);
        balls.push(newBall);
    }
}

function getPowerUpColor(type) {
    switch (type) {
        case 'speed': return '#FFD700';
        case 'shrinkPaddle': return '#FF6347';
        case 'reverseControls': return '#8A2BE2';
        case 'invisibleBall': return '#00CED1';
        case 'multiball': return '#32CD32';
        case 'extraLife': return '#DAA520';
        default: return '#FFF';
    }
}

function checkWinCondition() {
    if (player1Score >= winningScore || player2Score >= winningScore) {
        winner = player1Score >= winningScore ? 'Player 1' : 'Player 2';
        showWinScreen = true;
        gameRunning = false;
        if (soundEnabled) winSound.play();
        updateHighScores();
        addToLeaderboard(winner, Math.max(player1Score, player2Score));
        startCountdown();
    }
}

function updateHighScores() {
    if (player1Score > highScores.player1) highScores.player1 = player1Score;
    if (player2Score > highScores.player2) highScores.player2 = player2Score;
    localStorage.setItem('highScores', JSON.stringify(highScores));
    displayHighScores();
}

function displayHighScores() {
    document.getElementById('highScores').innerText = `High Scores - Player 1: ${highScores.player1}, Player 2: ${highScores.player2}`;
}

function resetHighScores() {
    highScores = { player1: 0, player2: 0 };
    localStorage.setItem('highScores', JSON.stringify(highScores));
    displayHighScores();
}

function updateLeaderboardDisplay() {
    const container = document.getElementById('leaderboard');
    container.innerHTML = '<h3>Leaderboard</h3>';
    leaderboard.sort((a, b) => b.score - a.score).slice(0, 5).forEach((entry, i) => {
        container.innerHTML += `<p>${i + 1}. ${entry.name}: ${entry.score}</p>`;
    });
}

function addToLeaderboard(name, score) {
    leaderboard.push({ name, score });
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    updateLeaderboardDisplay();
}

function startCountdown() {
    countdown = 5;
    countdownInterval = setInterval(() => {
        countdown--;
        if (soundEnabled) countdownSound.play();
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            startGame('ai-vs-ai');
        }
    }, 1000);
}

function changeTheme() {
    currentTheme = (currentTheme + 1) % themes.length;
    document.documentElement.style.setProperty('--theme-color', themes[currentTheme]);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('toggleSound').innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';
}

function toggleMusic() {
    isMusicPlaying = !isMusicPlaying;
    if (isMusicPlaying) {
        backgroundMusic.play();
    } else {
        backgroundMusic.pause();
    }
    document.getElementById('toggleMusic').innerText = isMusicPlaying ? 'Music: On' : 'Music: Off';
}

function adjustGameSpeed(amount) {
    gameSpeed = clamp(gameSpeed + amount, 0.5, 2);
    updateSpeedDisplay();
}

function updateSpeedDisplay() {
    document.getElementById('speedDisplay').innerText = `Speed: ${gameSpeed.toFixed(1)}x`;
}

function adjustAIDifficulty() {
    const difficulty = document.getElementById('difficultyLevel').value;
    aiDifficulty = difficulty === 'easy' ? 0.1 : difficulty === 'medium' ? 0.15 : 0.2;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen().catch(err => alert(`Fullscreen error: ${err.message}`));
    } else {
        document.exitFullscreen();
    }
}

function togglePowerUps() {
    powerUpsEnabled = !powerUpsEnabled;
    document.getElementById('togglePowerUps').innerText = powerUpsEnabled ? 'Power-Ups: On' : 'Power-Ups: Off';
    if (!powerUpsEnabled) {
        powerUpActive = false;
        powerUpVisible = false;
    }
}

function toggleInstructions() {
    const instructions = document.getElementById('instructions');
    instructions.style.display = (instructions.style.display === 'none' || !instructions.style.display) ? 'block' : 'none';
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value;
    if (message.trim() !== '') {
        const sanitizedMessage = sanitizeInput(message);
        const timestamp = new Date().toISOString();
        channel.publish('chat', {
            type: 'chat',
            username: currentUsername,
            content: sanitizedMessage,
            timestamp: timestamp
        });
        chatInput.value = '';
        chatTimestamps[sanitizedMessage] = timestamp;
    }
}

function displayChatMessage(username, content, timestamp) {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('p');
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let messageClass = '';
    if (username === currentUsername) {
        messageClass = 'my-message';
    } else {
        messageClass = 'other-message';
    }

    messageElement.classList.add(messageClass);
    messageElement.innerHTML = `<span class="timestamp">[${timeString}]</span> <span class="username">${username}:</span> ${content}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (Date.now() - new Date(timestamp).getTime() < 30000) {
        messageElement.classList.add('recent-message');
    }
}

async function loadChatHistory() {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    try {
        let page = await channel.history({ limit: 50, direction: 'forwards' });
        page.items.forEach(message => {
            if (message.data.type === 'chat') {
                displayChatMessage(message.data.username, message.data.content, message.data.timestamp);
            }
        });
    } catch (err) {
        console.error('Error loading chat history:', err);
    }
}

function startOnlineMultiplayer() {
    channel.publish('join-game', { clientId: ably.auth.clientId });
}