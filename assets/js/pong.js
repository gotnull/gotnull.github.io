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

// New feature: Replay functionality
let replayData = [];
let replayMode = false;
let replayFrameIndex = 0;

// New feature: Local Multiplayer with Gamepad Support
let gamepads = [];
let gamepadConnected = false;

// New feature: Customizable Paddle Color
let player1PaddleColor = '#FFF';
let player2PaddleColor = '#FFF';

// New feature: Custom Game Modes
let customGameModes = {
    'fastBall': {
        ballSpeed: INITIAL_BALL_SPEED * 1.5,
        paddleSpeed: 1.2
    },
    'tinyPaddles': {
        paddleHeight: INITIAL_PADDLE_HEIGHT / 2,
        paddleSpeed: 1
    },
    'giantBall': {
        ballSize: ballSize * 2,
        paddleSpeed: 1
    }
};

// New feature: Online Multiplayer with WebRTC
let peerConnection;
let dataChannel;

// New Feature: Dynamic Weather Effects
let weatherEffect = 'none'; // Options: 'none', 'rain', 'snow'

// New Feature: Power-Up Cooldown
let powerUpCooldown = false;

// New Feature: Game Recording
let recordingData = [];

// New Feature: Leaderboard Persistence and Sorting
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];

// New Feature: Game Timer
let gameTime = 0;
let gameTimer;

// New Feature: Tutorial Mode
let tutorialMode = false;
let tutorialStep = 0;
const tutorialSteps = [
    "Step 1: Use the arrow keys to move your paddle.",
    "Step 2: Hit the ball with your paddle to score points.",
    "Step 3: Watch out for power-ups that appear on the screen.",
    "Step 4: First player to reach the winning score wins the game!",
];

// New Feature: Voice Announcements
let announcementsEnabled = true;
const voiceAnnouncements = {
    "start": "Game starting!",
    "pause": "Game paused.",
    "resume": "Game resumed.",
    "win": (winner) => `${winner} wins the game!`,
    "powerUp": (type) => `Power-up activated: ${type}.`
};

// New Feature: Achievements
let achievements = {
    "firstWin": false,
    "highScore": false,
    "multiballMadness": false
};

// New Feature: Player Statistics
let playerStats = {
    player1: { hits: 0, misses: 0 },
    player2: { hits: 0, misses: 0 }
};

// New Feature: Save and Load Game State
let savedGameState = null;

// New Feature: Background Animation
let backgroundPattern = 'none'; // Options: 'none', 'stripes', 'grid'

// New Feature: Difficulty Adjustment
let difficultyLevel = 'medium';

// New Feature: Mini-Map
let miniMapEnabled = true;

// New Feature: Multi-language Support
let language = 'en';
const translations = {
    en: {
        start: "Start",
        pause: "Pause",
        replay: "Replay",
        powerUps: "Power-Ups",
        achievements: "Achievements",
        multiplayer: "Multiplayer",
        singleplayer: "Singleplayer",
        settings: "Settings",
        tutorial: "Tutorial"
    },
    es: {
        start: "Iniciar",
        pause: "Pausa",
        replay: "Repetir",
        powerUps: "Potenciadores",
        achievements: "Logros",
        multiplayer: "Multijugador",
        singleplayer: "Un jugador",
        settings: "Configuraciones",
        tutorial: "Tutorial"
    }
};

// New Feature: Power-Up Preview
let powerUpPreviewEnabled = false;

// New Feature: Game Statistics
let gameStatistics = {
    totalGamesPlayed: 0,
    totalPowerUpsCollected: 0
};

// New Feature: Multi-Ball Mode
let multiBallMode = false;

// New Feature: Enhanced AI with Learning
let aiLearningEnabled = true;
let aiReactionTime = 200; // in milliseconds
let aiExperience = [];

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

// New Feature: Weather Effects
function drawWeatherEffects() {
    if (weatherEffect === 'rain') {
        for (let i = 0; i < 100; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
            ctx.fillRect(x, y, 2, 10);
        }
    } else if (weatherEffect === 'snow') {
        for (let i = 0; i < 100; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// New Feature: Background Animation
function drawBackgroundPattern() {
    if (backgroundPattern === 'stripes') {
        for (let i = 0; i < canvas.width; i += 20) {
            ctx.strokeStyle = i % 40 === 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
    } else if (backgroundPattern === 'grid') {
        for (let i = 0; i < canvas.width; i += 20) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
    }
}

// New Function: Play Voice Announcement
function playVoiceAnnouncement(announcement, ...args) {
    if (!announcementsEnabled) return;
    const message = typeof announcement === 'function' ? announcement(...args) : announcement;
    const utterance = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(utterance);
}

// Tutorial Mode Functions
function startTutorial() {
    tutorialMode = true;
    tutorialStep = 0;
    displayTutorialStep();
}

function displayTutorialStep() {
    if (tutorialStep < tutorialSteps.length) {
        const tutorialBox = document.getElementById('tutorialBox');
        tutorialBox.innerText = tutorialSteps[tutorialStep];
        tutorialBox.style.display = 'block';
    } else {
        tutorialMode = false;
        document.getElementById('tutorialBox').style.display = 'none';
    }
}

function nextTutorialStep() {
    if (tutorialMode) {
        tutorialStep++;
        displayTutorialStep();
    }
}

// WebRTC Functions
async function startWebRTC() {
    peerConnection = new RTCPeerConnection();

    dataChannel = peerConnection.createDataChannel('gameData');
    dataChannel.onmessage = (event) => handleDataChannelMessage(event.data);

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            await sendSignal({ candidate: event.candidate });
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await sendSignal({ offer: offer });
}

async function handleSignal(signal) {
    if (signal.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
    } else if (signal.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await sendSignal({ answer: answer });
    } else if (signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
}

function handleDataChannelMessage(data) {
    const gameState = JSON.parse(data);
    player1Y = gameState.player1Y;
    player2Y = gameState.player2Y;
    balls = gameState.balls;
    player1Score = gameState.player1Score;
    player2Score = gameState.player2Score;
}

// New Function: Save replay state
function saveReplayState() {
    if (!replayMode) {
        replayData.push({
            player1Y,
            player2Y,
            balls: balls.map(ball => ({ ...ball })),
            player1Score,
            player2Score
        });
    }
}

// New Function: Start replay
function startReplay() {
    if (replayData.length > 0) {
        replayMode = true;
        replayFrameIndex = 0;
        replayLoop();
    }
}

// New Function: Replay loop
function replayLoop() {
    if (replayFrameIndex < replayData.length) {
        const frame = replayData[replayFrameIndex];
        player1Y = frame.player1Y;
        player2Y = frame.player2Y;
        balls = frame.balls.map(ball => ({ ...ball }));
        player1Score = frame.player1Score;
        player2Score = frame.player2Score;
        replayFrameIndex++;
        setTimeout(replayLoop, 1000 / 60); // Replay at 60 FPS
    } else {
        replayMode = false;
        initializeGame();
    }
    draw();
}

// New Function: Save Game State
function saveGameState() {
    savedGameState = {
        player1Y,
        player2Y,
        balls: balls.map(ball => ({ ...ball })),
        player1Score,
        player2Score,
        gameMode,
        powerUpActive,
        powerUpVisible,
        powerUpX,
        powerUpY,
        currentPowerUpType,
        powerUpTimer,
        ballVisible,
        controlsReversed,
        activePowerUps: JSON.parse(JSON.stringify(activePowerUps))
    };
    localStorage.setItem('savedGameState', JSON.stringify(savedGameState));
    alert('Game saved!');
}

// New Function: Load Game State
function loadGameState() {
    const savedState = JSON.parse(localStorage.getItem('savedGameState'));
    if (savedState) {
        player1Y = savedState.player1Y;
        player2Y = savedState.player2Y;
        balls = savedState.balls.map(ball => ({ ...ball }));
        player1Score = savedState.player1Score;
        player2Score = savedState.player2Score;
        gameMode = savedState.gameMode;
        powerUpActive = savedState.powerUpActive;
        powerUpVisible = savedState.powerUpVisible;
        powerUpX = savedState.powerUpX;
        powerUpY = savedState.powerUpY;
        currentPowerUpType = savedState.currentPowerUpType;
        powerUpTimer = savedState.powerUpTimer;
        ballVisible = savedState.ballVisible;
        controlsReversed = savedState.controlsReversed;
        activePowerUps = JSON.parse(JSON.stringify(savedState.activePowerUps));
        alert('Game loaded!');
        draw();
    } else {
        alert('No saved game found!');
    }
}

// New Function: Start Recording
function startRecording() {
    recordingData = [];
    recordGameState();
}

// New Function: Record Game State
function recordGameState() {
    if (gameRunning) {
        recordingData.push({
            player1Y,
            player2Y,
            balls: balls.map(ball => ({ ...ball })),
            player1Score,
            player2Score
        });
        setTimeout(recordGameState, 1000 / 60);
    }
}

// New Function: Play Recording
function playRecording() {
    if (recordingData.length > 0) {
        replayMode = true;
        replayFrameIndex = 0;
        replayLoop();
    }
}

// New Feature: Leaderboard Sorting
function sortLeaderboard() {
    leaderboard.sort((a, b) => b.score - a.score);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    updateLeaderboardDisplay();
}

// New Feature: Start Game Timer
function startGameTimer() {
    gameTime = 0;
    gameTimer = setInterval(() => {
        gameTime++;
        displayGameTime();
    }, 1000);
}

// New Feature: Display Game Timer
function displayGameTime() {
    const minutes = Math.floor(gameTime / 60);
    const seconds = gameTime % 60;
    document.getElementById('gameTimer').innerText = `Time: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// UI Binding and Event Handlers
function bindUI() {
    document.getElementById('startGame').onclick = () => { startGame('player-vs-ai'); playVoiceAnnouncement(voiceAnnouncements.start); };
    document.getElementById('startAI').onclick = () => { startGame('ai-vs-ai'); playVoiceAnnouncement(voiceAnnouncements.start); };
    document.getElementById('startMultiplayer').onclick = () => { startGame('multiplayer'); playVoiceAnnouncement(voiceAnnouncements.start); };
    document.getElementById('startOnlineMultiplayer').onclick = startOnlineMultiplayer;
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
    document.getElementById('sendMessage').onclick = sendMessage;
    document.getElementById('toggleMusic').onclick = toggleMusic;
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('toggleDarkMode').onclick = toggleDarkMode;
    document.getElementById('toggleNightMode').onclick = toggleNightMode;
    document.getElementById('pauseCountdown').onclick = togglePauseCountdown;
    document.getElementById('replayButton').onclick = startReplay;
    document.getElementById('paddleColor1').onchange = (e) => player1PaddleColor = e.target.value;
    document.getElementById('paddleColor2').onchange = (e) => player2PaddleColor = e.target.value;
    document.getElementById('startTutorial').onclick = startTutorial;
    document.getElementById('toggleAnnouncements').onclick = toggleAnnouncements;
    document.getElementById('saveGame').onclick = saveGameState;
    document.getElementById('loadGame').onclick = loadGameState;

    // New Game Mode Buttons
    document.getElementById('fastBallMode').onclick = () => startCustomGameMode('fastBall');
    document.getElementById('tinyPaddlesMode').onclick = () => startCustomGameMode('tinyPaddles');
    document.getElementById('giantBallMode').onclick = () => startCustomGameMode('giantBall');

    // Weather Effect Buttons
    document.getElementById('weatherNone').onclick = () => setWeatherEffect('none');
    document.getElementById('weatherRain').onclick = () => setWeatherEffect('rain');
    document.getElementById('weatherSnow').onclick = () => setWeatherEffect('snow');

    // New Recording Control Buttons
    document.getElementById('startRecording').onclick = startRecording;
    document.getElementById('playRecording').onclick = playRecording;

    // Sort Leaderboard
    document.getElementById('sortLeaderboard').onclick = sortLeaderboard;

    // Background Animation Buttons
    document.getElementById('backgroundPatternNone').onclick = () => setBackgroundPattern('none');
    document.getElementById('backgroundPatternStripes').onclick = () => setBackgroundPattern('stripes');
    document.getElementById('backgroundPatternGrid').onclick = () => setBackgroundPattern('grid');

    // Mini-map Toggle
    document.getElementById('toggleMiniMap').onclick = toggleMiniMap;

    // Language Toggle
    document.getElementById('toggleLanguage').onclick = toggleLanguage;

    // New Power-Up Preview Button
    document.getElementById('togglePowerUpPreview').onclick = togglePowerUpPreview;

    // Multi-Ball Mode Toggle
    document.getElementById('toggleMultiBallMode').onclick = toggleMultiBallMode;

    // Enhanced AI Learning Toggle
    document.getElementById('toggleAILearning').onclick = toggleAILearning;
}

function setWeatherEffect(effect) {
    weatherEffect = effect;
}

function setBackgroundPattern(pattern) {
    backgroundPattern = pattern;
}

// New Function: Toggle Language
function toggleLanguage() {
    language = language === 'en' ? 'es' : 'en';
    updateUIText();
}

function updateUIText() {
    document.getElementById('startGame').innerText = translations[language].start;
    document.getElementById('pauseGame').innerText = translations[language].pause;
    document.getElementById('replayButton').innerText = translations[language].replay;
    document.getElementById('togglePowerUps').innerText = translations[language].powerUps;
    document.getElementById('achievements').innerText = translations[language].achievements;
    document.getElementById('startMultiplayer').innerText = translations[language].multiplayer;
    document.getElementById('startGame').innerText = translations[language].singleplayer;
    document.getElementById('startTutorial').innerText = translations[language].tutorial;
    document.getElementById('settings').innerText = translations[language].settings;
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
    replayData = [];
    replayMode = false;
    gamepads = [];
    gamepadConnected = false;
    tutorialMode = false;
    multiBallMode = false;
    playerStats = {
        player1: { hits: 0, misses: 0 },
        player2: { hits: 0, misses: 0 }
    };

    updateSpeedDisplay();
    displayHighScores();
    updateLeaderboardDisplay();
    displayPowerUpHistory();
    checkAchievements();
    resizeCanvas();
    checkGamepads();
    startGameTimer();
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
    gameStatistics.totalGamesPlayed++;
    updateGameStatisticsDisplay();
}

function startCustomGameMode(mode) {
    const settings = customGameModes[mode];
    if (settings) {
        initializeGame();
        gameMode = mode;
        gameRunning = true;
        showWinScreen = false;
        ballSpeedMultiplier = settings.ballSpeed || 1;
        paddleHeight = settings.paddleHeight || INITIAL_PADDLE_HEIGHT;
        gameSpeed = settings.paddleSpeed || 1;
        document.getElementById('gameModeDisplay').innerText = `Mode: ${mode.replace('-', ' ').toUpperCase()}`;
        balls = [createBall()];
        resetBall(balls[0]);
        if (powerUpsEnabled) spawnPowerUp();
        gameLoop();
    }
}

function gameLoop(timestamp) {
    animationFrameId = requestAnimationFrame(gameLoop);
    calculateFPS(timestamp);
    update();
    draw();
}

function togglePause() {
    if (showWinScreen || replayMode) return;
    gameRunning = !gameRunning;
    playVoiceAnnouncement(gameRunning ? voiceAnnouncements.resume : voiceAnnouncements.pause);
    if (gameRunning) {
        gameLoop();
        startGameTimer();
    } else {
        clearInterval(gameTimer);
    }
}

function createBall() {
    return { x: canvas.width / 2, y: canvas.height / 2, speedX: 0, speedY: 0 };
}

function resetBall(ball) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * gameSpeed * ballSpeedMultiplier;
    ball.speedY = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED * gameSpeed * ballSpeedMultiplier;
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

// New Function: Toggle Power-Up Preview
function togglePowerUpPreview() {
    powerUpPreviewEnabled = !powerUpPreviewEnabled;
    document.getElementById('togglePowerUpPreview').innerText = powerUpPreviewEnabled ? 'Power-Up Preview: On' : 'Power-Up Preview: Off';
}

// New Function: Update Game Statistics Display
function updateGameStatisticsDisplay() {
    const statsElement = document.getElementById('gameStatistics');
    statsElement.innerHTML = `<strong>Games Played:</strong> ${gameStatistics.totalGamesPlayed} | 
                              <strong>Power-Ups Collected:</strong> ${gameStatistics.totalPowerUpsCollected}`;
}

// New Function: Toggle Multi-Ball Mode
function toggleMultiBallMode() {
    multiBallMode = !multiBallMode;
    document.getElementById('toggleMultiBallMode').innerText = multiBallMode ? 'Multi-Ball Mode: On' : 'Multi-Ball Mode: Off';
    if (multiBallMode) {
        while (balls.length < 3) {
            let newBall = createBall();
            resetBall(newBall);
            balls.push(newBall);
        }
    } else {
        balls = balls.slice(0, 1);
    }
}

// New Function: Toggle AI Learning
function toggleAILearning() {
    aiLearningEnabled = !aiLearningEnabled;
    document.getElementById('toggleAILearning').innerText = aiLearningEnabled ? 'AI Learning: On' : 'AI Learning: Off';
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
    updateGameStatisticsDisplay();
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
window.addEventListener('gamepadconnected', (e) => {
    gamepads[e.gamepad.index] = e.gamepad;
    gamepadConnected = true;
});
window.addEventListener('gamepaddisconnected', (e) => {
    delete gamepads[e.gamepad.index];
    gamepadConnected = false;
});

function handleAblyMessage(message) {
    switch (message.type) {
        case 'chat':
            displayChatMessage(message.username, message.content, message.timestamp);
            break;
        case 'signal':
            handleSignal(message.signal);
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
    if (!gameRunning || showWinScreen || replayMode) return;

    handleInput();
    saveReplayState();

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
            playerStats.player1.hits++;
        } else if (ball.x >= canvas.width - paddleWidth - ballSize && ball.y >= player2Y && ball.y <= player2Y + paddleHeight) {
            ball.speedX = -Math.abs(ball.speedX);
            ball.speedY = (ball.y - (player2Y + paddleHeight / 2)) * 0.35;
            if (soundEnabled) hitSound.play();
            playerStats.player2.hits++;
        } else {
            if (ball.x < 0) {
                player2Score++;
                playerStats.player1.misses++;
                balls.splice(i, 1);
                checkWinCondition();
            } else if (ball.x > canvas.width) {
                player1Score++;
                playerStats.player2.misses++;
                balls.splice(i, 1);
                checkWinCondition();
            }
        }

        if (powerUpActive && powerUpVisible) {
            const dx = Math.abs(ball.x - powerUpX);
            const dy = Math.abs(ball.y - powerUpY);
            if (dx < ballSize && dy < ballSize && !powerUpCooldown) {
                handlePowerUpEffect();
                powerUpVisible = false;
                powerUpActive = false;
                powerUpCooldown = true;
                setTimeout(() => powerUpCooldown = false, 5000); // 5 seconds cooldown
            }
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

    // Handle gamepad input
    if (gamepadConnected) {
        handleGamepadInput();
    }

    // Send game state over WebRTC for online multiplayer
    if (dataChannel && dataChannel.readyState === 'open') {
        const gameState = JSON.stringify({
            player1Y: player1Y,
            player2Y: player2Y,
            balls: balls,
            player1Score: player1Score,
            player2Score: player2Score
        });
        dataChannel.send(gameState);
    }

    // Display power-up preview if enabled
    if (powerUpPreviewEnabled && powerUpActive && powerUpVisible) {
        displayPowerUpPreview();
    }
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

function handleGamepadInput() {
    const gamepad = navigator.getGamepads()[0];
    if (!gamepad) return;

    const player1Axis = gamepad.axes[1];
    const player2Axis = gamepads[1] ? gamepads[1].axes[1] : 0;

    if (Math.abs(player1Axis) > 0.1) player1Y += player1Axis * 5 * (controlsReversed ? -1 : 1);
    if (Math.abs(player2Axis) > 0.1) player2Y += player2Axis * 5 * (controlsReversed ? -1 : 1);

    player1Y = clamp(player1Y, 0, canvas.height - paddleHeight);
    player2Y = clamp(player2Y, 0, canvas.height - paddleHeight);
}

function draw() {
    drawRect(0, 0, canvas.width, canvas.height, nightModeEnabled ? 'rgba(0, 0, 0, 0.8)' : '#000');
    drawBackgroundPattern();

    drawRect(0, player1Y, paddleWidth, paddleHeight, player1PaddleColor);
    drawRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight, player2PaddleColor);

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
    drawWeatherEffects();
    drawMiniMap();

    if (pauseCountdown > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '30px Arial';
        ctx.fillText(`Resuming in ${pauseCountdown}...`, canvas.width / 2 - 120, canvas.height / 2);
    }
}

// New Function: Display Power-Up Preview
function displayPowerUpPreview() {
    const previewElement = document.getElementById('powerUpPreview');
    previewElement.innerText = `Upcoming Power-Up: ${currentPowerUpType.toUpperCase()}`;
    previewElement.style.display = 'block';
}

function drawMiniMap() {
    if (!miniMapEnabled) return;

    const mapWidth = 150;
    const mapHeight = 75;
    const scaleX = mapWidth / canvas.width;
    const scaleY = mapHeight / canvas.height;

    // Drawing the minimap background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(canvas.width - mapWidth - 10, 10, mapWidth, mapHeight);

    // Drawing paddles and balls on the minimap
    ctx.fillStyle = player1PaddleColor;
    ctx.fillRect((canvas.width - mapWidth - 10) + player1Y * scaleX, 10, paddleWidth * scaleX, paddleHeight * scaleY);
    ctx.fillStyle = player2PaddleColor;
    ctx.fillRect((canvas.width - mapWidth - 10) + player2Y * scaleX, 10, paddleWidth * scaleX, paddleHeight * scaleY);

    balls.forEach(ball => {
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc((canvas.width - mapWidth - 10) + ball.x * scaleX, 10 + ball.y * scaleY, ballSize * scaleX, 0, Math.PI * 2);
        ctx.fill();
    });
}

function spawnPowerUp() {
    if (!powerUpsEnabled || powerUpCooldown) return;
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
    gameStatistics.totalPowerUpsCollected++;
    updateGameStatisticsDisplay();
    if (powerUpHistory.length > 5) powerUpHistory.pop();
    displayPowerUpHistory();
    playVoiceAnnouncement(voiceAnnouncements.powerUp, currentPowerUpType);

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
        clearInterval(gameTimer);
        if (soundEnabled) winSound.play();
        playVoiceAnnouncement(voiceAnnouncements.win, winner);
        updateHighScores();
        addToLeaderboard(winner, Math.max(player1Score, player2Score));
        checkAchievements();
        sortLeaderboard();
        startCountdown();
    }
}

function updateHighScores() {
    if (player1Score > highScores.player1) highScores.player1 = player1Score;
    if (player2Score > highScores.player2) player2Score = player2Score;
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
    leaderboard.slice(0, 5).forEach((entry, i) => {
        container.innerHTML += `<p>${i + 1}. ${entry.name}: ${entry.score}</p>`;
    });
}

function addToLeaderboard(name, score) {
    leaderboard.push({ name, score });
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
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

async function startOnlineMultiplayer() {
    await startWebRTC();
    channel.publish('join-game', { clientId: ably.auth.clientId });
}

function checkGamepads() {
    const check = setInterval(() => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        if (gamepads[0]) {
            gamepadConnected = true;
            clearInterval(check);
        }
    }, 1000);
}

function toggleAnnouncements() {
    announcementsEnabled = !announcementsEnabled;
    document.getElementById('toggleAnnouncements').innerText = announcementsEnabled ? 'Announcements: On' : 'Announcements: Off';
}

// New Function: Check Achievements
function checkAchievements() {
    if (!achievements.firstWin && (player1Score >= winningScore || player2Score >= winningScore)) {
        achievements.firstWin = true;
        alert("Achievement Unlocked: First Win!");
    }
    if (!achievements.highScore && Math.max(player1Score, player2Score) > 10) {
        achievements.highScore = true;
        alert("Achievement Unlocked: High Score!");
    }
    if (!achievements.multiballMadness && balls.length > 1) {
        achievements.multiballMadness = true;
        alert("Achievement Unlocked: Multiball Madness!");
    }
    displayPlayerStats();
}

// New Function: Display Player Statistics
function displayPlayerStats() {
    const statsElement = document.getElementById('playerStats');
    statsElement.innerHTML = `<strong>Player 1:</strong> Hits: ${playerStats.player1.hits}, Misses: ${playerStats.player1.misses} | 
                              <strong>Player 2:</strong> Hits: ${playerStats.player2.hits}, Misses: ${playerStats.player2.misses}`;
}

// New Function: Toggle Mini Map
function toggleMiniMap() {
    miniMapEnabled = !miniMapEnabled;
    document.getElementById('toggleMiniMap').innerText = miniMapEnabled ? 'Mini-Map: On' : 'Mini-Map: Off';
}