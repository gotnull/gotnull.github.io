const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const paddleWidth = 10;
const INITIAL_PADDLE_HEIGHT = 100;
const ballSize = 10;
const INITIAL_BALL_SPEED = 5;
const winningScore = 5;

// Game state variables
let paddleHeight = INITIAL_PADDLE_HEIGHT;
let ballSpeedMultiplier = 1;
let gameSpeed = 1;

// Player positions and speeds
let player1Y = canvas.height / 2 - paddleHeight / 2;
let player2Y = canvas.height / 2 - paddleHeight / 2;
let player2Speed = 0;

// Game objects
let balls = [];
let player1Score = 0;
let player2Score = 0;

// Game control variables
let gameRunning = false;
let gameMode = 'ai-vs-ai';
let showWinScreen = false;
let winner = '';
let countdown = 5;
let countdownInterval;

// Power-up variables
let powerUpActive = false;
let powerUpVisible = false;
let powerUpX, powerUpY, currentPowerUpType = '';
let powerUpTimer = 0;
let powerUpsEnabled = true;
let ballVisible = true;
let controlsReversed = false;

// Sound and theme variables
let soundEnabled = true;
let currentTheme = 0;
const themes = ['#007BFF', '#28A745', '#FFC107', '#DC3545'];
const powerUpTypes = ['speed', 'shrinkPaddle', 'reverseControls', 'invisibleBall', 'multiball'];

// AI difficulty
let aiDifficulty = 0.15;

// High scores and leaderboard
let highScores = JSON.parse(localStorage.getItem('highScores')) || { player1: 0, player2: 0 };
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];

// Create mock audio objects since we can't use real audio files
const createMockAudio = () => ({
    play: () => {},
    pause: () => {},
    muted: false
});

const soundEffect = createMockAudio();
const hitSound = createMockAudio();
const winSound = createMockAudio();
const countdownSound = createMockAudio();

// Event listeners
document.getElementById('startGame').addEventListener('click', () => startGame('player-vs-ai'));
document.getElementById('startAI').addEventListener('click', () => startGame('ai-vs-ai'));
document.getElementById('startMultiplayer').addEventListener('click', () => startGame('multiplayer'));
document.getElementById('pauseGame').addEventListener('click', togglePause);
document.getElementById('changeTheme').addEventListener('click', changeTheme);
document.getElementById('toggleSound').addEventListener('click', toggleSound);
document.getElementById('increaseSpeed').addEventListener('click', () => adjustGameSpeed(0.1));
document.getElementById('decreaseSpeed').addEventListener('click', () => adjustGameSpeed(-0.1));
document.getElementById('resetHighScores').addEventListener('click', resetHighScores);
document.getElementById('instructionsButton').addEventListener('click', toggleInstructions);
document.getElementById('difficultyLevel').addEventListener('change', adjustAIDifficulty);
document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);
document.getElementById('togglePowerUps').addEventListener('click', togglePowerUps);

// Initialize game
function initializeGame() {
    // Reset all game state to initial values
    paddleHeight = INITIAL_PADDLE_HEIGHT;
    ballSpeedMultiplier = 1;
    gameSpeed = 1;
    player1Y = canvas.height / 2 - paddleHeight / 2;
    player2Y = canvas.height / 2 - paddleHeight / 2;
    player2Speed = 0;
    player1Score = 0;
    player2Score = 0;
    powerUpActive = false;
    powerUpVisible = false;
    ballVisible = true;
    controlsReversed = false;
    balls = [];
    
    // Clear any existing intervals
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Reset event listeners to normal
    resetEventListeners();
    
    updateSpeedDisplay();
    displayHighScores();
    updateLeaderboardDisplay();
}

function startGame(mode) {
    initializeGame();
    
    showWinScreen = false;
    gameRunning = true;
    gameMode = mode;
    
    document.getElementById('gameModeDisplay').innerText = `Mode: ${mode.replace('-', ' vs ').toUpperCase()}`;
    
    // Create initial ball
    balls = [createBall()];
    resetBall(balls[0]);
    
    // Spawn power-up if enabled
    if (powerUpsEnabled) {
        spawnPowerUp();
    }
    
    gameLoop();
}

function createBall() {
    return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        speedX: 0,
        speedY: 0
    };
}

function resetBall(ball) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * gameSpeed;
    ball.speedY = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * gameSpeed;
}

function togglePause() {
    if (showWinScreen) return;
    gameRunning = !gameRunning;
    if (gameRunning) gameLoop();
}

function changeTheme() {
    currentTheme = (currentTheme + 1) % themes.length;
    document.documentElement.style.setProperty('--theme-color', themes[currentTheme]);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('toggleSound').innerText = soundEnabled ? 'Sound: On' : 'Sound: Off';
}

function adjustGameSpeed(amount) {
    gameSpeed = Math.max(0.5, Math.min(2, gameSpeed + amount));
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
        canvas.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
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

// Drawing functions
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

// Power-up functions
function spawnPowerUp() {
    if (!powerUpsEnabled) return;
    
    powerUpActive = true;
    powerUpVisible = true;
    powerUpX = Math.random() * (canvas.width - 30) + 15;
    powerUpY = Math.random() * (canvas.height - 30) + 15;
    currentPowerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    powerUpTimer = 10;
    
    // Hide power-up after 10 seconds
    setTimeout(() => {
        powerUpVisible = false;
        // Deactivate power-up 5 seconds after it becomes invisible
        setTimeout(() => {
            powerUpActive = false;
        }, 5000);
    }, 10000);
}

function handlePowerUpEffect() {
    switch (currentPowerUpType) {
        case 'speed':
            ballSpeedMultiplier = 1.5;
            balls.forEach(ball => {
                ball.speedX *= 1.5;
                ball.speedY *= 1.5;
            });
            setTimeout(() => {
                ballSpeedMultiplier = 1;
                balls.forEach(ball => {
                    ball.speedX /= 1.5;
                    ball.speedY /= 1.5;
                });
            }, 10000);
            break;
            
        case 'shrinkPaddle':
            paddleHeight = Math.max(paddleHeight - 20, 40);
            setTimeout(() => {
                paddleHeight = INITIAL_PADDLE_HEIGHT;
            }, 10000);
            break;
            
        case 'reverseControls':
            controlsReversed = true;
            setTimeout(() => {
                controlsReversed = false;
            }, 10000);
            break;
            
        case 'invisibleBall':
            ballVisible = false;
            setTimeout(() => {
                ballVisible = true;
            }, 5000);
            break;
            
        case 'multiball':
            addAdditionalBalls();
            break;
    }
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
        default: return '#FFF';
    }
}

// Input handling
let keysPressed = {};

function resetEventListeners() {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e) {
    keysPressed[e.key] = true;
}

function handleKeyUp(e) {
    keysPressed[e.key] = false;
}

function handleInput() {
    if (gameMode === 'player-vs-ai') {
        // Only player 2 (right paddle) is controlled by human
        if (keysPressed['ArrowUp']) {
            player2Speed = controlsReversed ? 5 : -5;
        } else if (keysPressed['ArrowDown']) {
            player2Speed = controlsReversed ? -5 : 5;
        } else {
            player2Speed = 0;
        }
    } else if (gameMode === 'multiplayer') {
        // Player 1 controls
        if (keysPressed['w'] || keysPressed['W']) {
            player1Y = Math.max(player1Y - (controlsReversed ? -5 : 5), 0);
        }
        if (keysPressed['s'] || keysPressed['S']) {
            player1Y = Math.min(player1Y + (controlsReversed ? -5 : 5), canvas.height - paddleHeight);
        }
        
        // Player 2 controls
        if (keysPressed['ArrowUp']) {
            player2Speed = controlsReversed ? 5 : -5;
        } else if (keysPressed['ArrowDown']) {
            player2Speed = controlsReversed ? -5 : 5;
        } else {
            player2Speed = 0;
        }
    }
}

// Game logic
function update() {
    if (!gameRunning || showWinScreen) return;

    handleInput();

    // AI for player 1 (always AI controlled)
    if (balls.length > 0) {
        const target = balls.reduce((closest, ball) => {
            return Math.abs(ball.x - 0) < Math.abs(closest.x - 0) ? ball : closest;
        }, balls[0]);
        
        player1Y += (target.y - (player1Y + paddleHeight / 2)) * aiDifficulty;
        player1Y = Math.max(0, Math.min(canvas.height - paddleHeight, player1Y));
    }

    // AI for player 2 (only in AI vs AI mode)
    if (gameMode === 'ai-vs-ai' && balls.length > 0) {
        const target = balls.reduce((closest, ball) => {
            return Math.abs(ball.x - canvas.width) < Math.abs(closest.x - canvas.width) ? ball : closest;
        }, balls[0]);
        
        player2Y += (target.y - (player2Y + paddleHeight / 2)) * aiDifficulty;
    } else if (gameMode === 'player-vs-ai' || gameMode === 'multiplayer') {
        player2Y += player2Speed;
    }

    player2Y = Math.max(0, Math.min(canvas.height - paddleHeight, player2Y));

    // Update balls
    for (let i = balls.length - 1; i >= 0; i--) {
        let ball = balls[i];

        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // Ball collision with top and bottom walls
        if (ball.y <= 0 || ball.y >= canvas.height - ballSize) {
            ball.speedY = -ball.speedY;
            if (soundEnabled) hitSound.play();
        }

        // Ball collision with paddles
        if (ball.x <= paddleWidth && ball.y >= player1Y && ball.y <= player1Y + paddleHeight) {
            ball.speedX = Math.abs(ball.speedX); // Ensure ball goes right
            let deltaY = ball.y - (player1Y + paddleHeight / 2);
            ball.speedY = deltaY * 0.35;
            if (soundEnabled) hitSound.play();
        } else if (ball.x >= canvas.width - paddleWidth - ballSize && ball.y >= player2Y && ball.y <= player2Y + paddleHeight) {
            ball.speedX = -Math.abs(ball.speedX); // Ensure ball goes left
            let deltaY = ball.y - (player2Y + paddleHeight / 2);
            ball.speedY = deltaY * 0.35;
            if (soundEnabled) hitSound.play();
        }

        // Ball collision with power-up
        if (powerUpActive && powerUpVisible) {
            const distX = Math.abs(ball.x - powerUpX);
            const distY = Math.abs(ball.y - powerUpY);
            if (distX < ballSize && distY < ballSize) {
                handlePowerUpEffect();
                powerUpVisible = false;
                powerUpActive = false;
            }
        }

        // Scoring
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

    // Add new ball if all balls are gone
    if (balls.length === 0 && !showWinScreen) {
        let newBall = createBall();
        resetBall(newBall);
        balls.push(newBall);
        
        if (powerUpsEnabled && !powerUpActive) {
            spawnPowerUp();
        }
    }

    // Update power-up timer
    if (powerUpActive && powerUpTimer > 0) {
        powerUpTimer -= 1/60; // Assuming 60 FPS
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

function draw() {
    // Clear canvas
    drawRect(0, 0, canvas.width, canvas.height, '#000');

    // Draw paddles
    drawRect(0, player1Y, paddleWidth, paddleHeight, '#FFF');
    drawRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight, '#FFF');

    // Draw balls
    balls.forEach(ball => {
        if (ballVisible) {
            drawCircle(ball.x, ball.y, ballSize, '#FFF');
        }
    });

    // Draw center line
    ctx.setLineDash([5, 15]);
    ctx.strokeStyle = '#FFF';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw scores
    ctx.font = '30px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText(player1Score, canvas.width / 4, 50);
    ctx.fillText(player2Score, canvas.width * 3 / 4, 50);

    // Draw power-up
    if (powerUpActive && powerUpVisible) {
        drawCircle(powerUpX, powerUpY, 15, getPowerUpColor(currentPowerUpType));
    }

    // Draw power-up info
    if (powerUpActive) {
        ctx.fillStyle = '#FFD700';
        ctx.font = '16px Arial';
        ctx.fillText(`Power-Up: ${currentPowerUpType.toUpperCase()} (${powerUpTimer.toFixed(1)}s)`, 10, canvas.height - 20);
    }

    // Draw win screen
    if (showWinScreen) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '30px Arial';
        ctx.fillText(`${winner} Wins!`, canvas.width / 2 - 80, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText(`Game restarts in ${countdown}...`, canvas.width / 2 - 120, canvas.height / 2 + 50);
    }

    // Draw FPS
    drawFPS();
}

// High scores and leaderboard
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
    const leaderboardDisplay = document.getElementById('leaderboard');
    leaderboardDisplay.innerHTML = '<h3>Leaderboard</h3>';
    leaderboard.sort((a, b) => b.score - a.score).slice(0, 5).forEach((entry, index) => {
        leaderboardDisplay.innerHTML += `<p>${index + 1}. ${entry.name}: ${entry.score}</p>`;
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

// FPS counter
let lastFrameTime = 0;
let fps = 0;

function drawFPS() {
    ctx.fillStyle = '#FFF';
    ctx.font = '14px Arial';
    ctx.fillText(`FPS: ${fps}`, 10, 20);
}

function calculateFPS(timestamp) {
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    fps = Math.round(1000 / delta);
}

// Game loop
function gameLoop(timestamp) {
    calculateFPS(timestamp);
    update();
    draw();
    
    if (gameRunning || showWinScreen) {
        requestAnimationFrame(gameLoop);
    }
}

// Initialize event listeners
resetEventListeners();

// Start the game
initializeGame();
startGame('ai-vs-ai');