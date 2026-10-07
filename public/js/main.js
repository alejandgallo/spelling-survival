// Main Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
    
    GameEngine.init();

    const screens = document.querySelectorAll('.screen');
    
    // DOM Elements (same as before)
    const btnHost = document.getElementById('btn-host');
    const btnJoin = document.getElementById('btn-join');
    const hostScreen = document.getElementById('host-screen');
    const wordListInput = document.getElementById('word-list');
    const btnLoadTxt = document.getElementById('btn-load-txt');
    const fileInput = document.getElementById('file-input');
    const lavaSpeedSlider = document.getElementById('lava-speed');
    const lavaSpeedValue = document.getElementById('lava-speed-value');
    const btnGenerateRoom = document.getElementById('btn-generate-room');
    const roomCreatedSection = document.getElementById('room-created-section');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const playerCount = document.getElementById('player-count');
    const playerList = document.getElementById('player-list');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnBackHome = document.getElementById('btn-back-home');
    const joinScreen = document.getElementById('join-screen');
    const joinCodeInput = document.getElementById('join-code');
    const playerNameInput = document.getElementById('player-name');
    const colorHead = document.getElementById('color-head');
    const colorBody = document.getElementById('color-body');
    const colorLegs = document.getElementById('color-legs');
    const btnConnect = document.getElementById('btn-connect');
    const btnBackHome2 = document.getElementById('btn-back-home-2');
    const connectingScreen = document.getElementById('connecting-screen');
    const gameScreen = document.getElementById('game-screen');
    const currentWordHint = document.getElementById('current-word-hint');
    const typingInput = document.getElementById('typing-input');
    const btnSubmitWord = document.getElementById('btn-submit-word');
    const btnReplay = document.getElementById('btn-replay');
    const gameOverScreen = document.getElementById('game-over-screen');
    const gameOverTitle = document.getElementById('game-over-title');
    const gameOverMessage = document.getElementById('game-over-message');
    const btnPlayAgain = document.getElementById('btn-play-again');

    let socket = null;
    let isHost = false;
    let localPlayerData = {};
    let currentWord = "";
    
    // FIX: Throttle variable for network movement
    let lastMoveSent = 0; 

    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        
        // FIX: Keep focus on typing input during game
        if (screenId === 'game-screen') {
            typingInput.focus();
        }
    }

    // --- HOME SCREEN ---
    btnHost.addEventListener('click', () => {
        isHost = true;
        showScreen('host-screen');
    });

    btnJoin.addEventListener('click', () => {
        isHost = false;
        showScreen('join-screen');
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) {
            joinCodeInput.value = roomParam.toUpperCase();
        }
    });

    btnBackHome.addEventListener('click', () => showScreen('home-screen'));
    btnBackHome2.addEventListener('click', () => showScreen('home-screen'));

    // --- HOST SCREEN ---
    btnLoadTxt.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            wordListInput.value = event.target.result;
        };
        reader.readAsText(file);
    });

    lavaSpeedSlider.addEventListener('input', (e) => {
        lavaSpeedValue.textContent = e.target.value;
    });

    btnGenerateRoom.addEventListener('click', () => {
        if (!socket) initSocket();
        
        const words = wordListInput.value.split('\n').filter(w => w.trim() !== '');
        if (words.length < 3) {
            alert("Please enter at least 3 words!");
            return;
        }

        const lavaSpeed = parseFloat(lavaSpeedSlider.value);

        socket.emit('createRoom', { words, lavaSpeed }, (response) => {
            if (response.success) {
                roomCodeDisplay.textContent = response.roomCode;
                const joinUrl = `${window.location.origin}?room=${response.roomCode}`;
                qrcodeContainer.innerHTML = '';
                new QRCode(qrcodeContainer, {
                    text: joinUrl,
                    width: 128,
                    height: 128,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
                roomCreatedSection.style.display = 'block';
                
                localPlayerData = {
                    roomCode: response.roomCode,
                    playerName: "Host",
                    playerColor: { head: "#ff0000", body: "#ffffff", legs: "#0000ff" }
                };
                socket.emit('joinRoom', localPlayerData, (joinRes) => {
                    if (joinRes.success) {
                        GameEngine.setLocalPlayer(socket.id);
                        GameEngine.updatePlayers(joinRes.players);
                        GameEngine.buildWaitingRoom();
                    }
                });
            }
        });
    });

    btnStartGame.addEventListener('click', () => {
        if (!socket || !localPlayerData.roomCode) return;
        socket.emit('startGame', localPlayerData.roomCode);
    });

    // --- JOIN SCREEN ---
    btnConnect.addEventListener('click', () => {
        if (!socket) initSocket();
        
        localPlayerData = {
            roomCode: joinCodeInput.value.toUpperCase(),
            playerName: playerNameInput.value || "Player" + Math.floor(Math.random() * 100),
            playerColor: {
                head: colorHead.value,
                body: colorBody.value,
                legs: colorLegs.value
            }
        };

        showScreen('connecting-screen');
        GameEngine.setLocalPlayer(null);
        
        socket.emit('joinRoom', localPlayerData, (response) => {
            if (response.success) {
                GameEngine.setLocalPlayer(socket.id);
                GameEngine.updatePlayers(response.players);
                GameEngine.buildWaitingRoom();
                
                if (GameEngine.players[socket.id]) {
                    GameEngine.players[socket.id].startFloating();
                }
                
                setTimeout(() => {
                    if (GameEngine.players[socket.id]) {
                        GameEngine.players[socket.id].stopFloating();
                    }
                    showScreen('waiting-screen');
                }, 2000);
            } else {
                alert("Failed to join room: " + response.message);
                showScreen('join-screen');
            }
        });
    });

    // --- GAME LOGIC ---
    function speakWord(word) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            window.speechSynthesis.speak(utterance);
        }
    }

    btnReplay.addEventListener('click', () => {
        if (currentWord) speakWord(currentWord);
    });

    btnSubmitWord.addEventListener('click', submitWord);
    
    typingInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitWord();
    });

    // FIX: Clicking the 3D area shouldn't lose focus from input for long
    document.getElementById('canvas-container').addEventListener('click', () => {
        if (gameScreen.classList.contains('active')) {
            typingInput.focus();
        }
    });

    function submitWord() {
        const typedWord = typingInput.value.trim();
        if (!typedWord || !socket) return;

        socket.emit('submitWord', { roomCode: localPlayerData.roomCode, typedWord }, (response) => {
            if (response.correct) {
                typingInput.value = "";
                typingInput.style.borderColor = "#2ed573";
                setTimeout(() => { typingInput.style.borderColor = ""; }, 500);
            } else {
                typingInput.style.borderColor = "#ff4757";
                setTimeout(() => { typingInput.style.borderColor = ""; }, 500);
                typingInput.value = "";
            }
        });
    }

    btnPlayAgain.addEventListener('click', () => {
        window.location.href = window.location.origin; // Clear url params
    });

    // --- SOCKET.IO ---
    function initSocket() {
        socket = io();

        socket.on('connect', () => {
            console.log('Connected to server!');
        });

        socket.on('updatePlayers', (players) => {
            GameEngine.updatePlayers(players);
            if (isHost && roomCreatedSection.style.display !== 'none') {
                const count = Object.keys(players).length;
                playerCount.textContent = count;
                playerList.innerHTML = '';
                Object.values(players).forEach(p => {
                    const li = document.createElement('li');
                    li.textContent = p.name;
                    li.style.color = p.color.body;
                    playerList.appendChild(li);
                });
            }
        });

        socket.on('movePlayer', (data) => {
            GameEngine.movePlayer(data.playerId, data.position);
        });

        socket.on('gameStarted', (data) => {
            GameEngine.updatePlayers(data.players);
            GameEngine.buildGameArena();
            showScreen('game-screen');
            typingInput.focus();
        });

        socket.on('newWord', (data) => {
            currentWord = data.word;
            currentWordHint.textContent = "🔊 Listen carefully...";
            speakWord(currentWord);
        });

        socket.on('playerClimbed', (data) => {
            GameEngine.climbPlayer(data.playerId, data.step);
        });

        socket.on('updateLava', (data) => {
            GameEngine.setLavaHeight(data.height);
        });

        socket.on('playerEliminated', (data) => {
            GameEngine.eliminatePlayer(data.playerId);
            if (data.playerId === socket.id) {
                gameOverTitle.textContent = "You Burned!";
                gameOverMessage.textContent = "The lava caught you. Better luck next time!";
                showScreen('game-over-screen');
            }
        });

        socket.on('gameOver', (data) => {
            if (data.winner) {
                gameOverTitle.textContent = "Winner!";
                gameOverMessage.textContent = `${data.winner.name} escaped the lava!`;
            } else {
                gameOverTitle.textContent = "Game Over!";
                gameOverMessage.textContent = "Everyone was caught by the lava!";
            }
            showScreen('game-over-screen');
        });

        socket.on('roomClosed', () => {
            alert("The host closed the room.");
            window.location.href = window.location.origin;
        });
    }

    // FIX: Throttled network movement
    window.GameNetwork = {
        sendMovement: function(pos) {
            if (socket && localPlayerData.roomCode) {
                const now = Date.now();
                if (now - lastMoveSent > 50) { // 20 msgs per second max
                    socket.emit('movePlayer', { roomCode: localPlayerData.roomCode, position: pos });
                    lastMoveSent = now;
                }
            }
        }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) {
        btnJoin.click();
    }
});