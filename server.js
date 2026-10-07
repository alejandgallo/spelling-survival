const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return rooms[result] ? generateRoomCode() : result;
}

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    socket.on('createRoom', async (data, callback) => {
        const roomCode = generateRoomCode();
        const { words, lavaSpeed } = data;

        rooms[roomCode] = {
            hostId: socket.id,
            players: {},
            wordList: words,
            lavaSpeed: lavaSpeed,
            gameState: 'waiting',
            currentWord: '',
            lavaHeight: 0,
            roundActive: false
        };

        socket.join(roomCode);
        callback({ success: true, roomCode: roomCode });
    });

    socket.on('joinRoom', (data, callback) => {
        const { roomCode, playerName, playerColor } = data;
        const room = rooms[roomCode];

        if (!room) {
            return callback({ success: false, message: 'Room not found!' });
        }

        room.players[socket.id] = {
            id: socket.id,
            name: playerName,
            color: playerColor,
            position: { x: 0, y: 0, z: 0 },
            ladderStep: 0,
            isOut: false
        };

        socket.join(roomCode);
        callback({ success: true, roomCode: roomCode, players: room.players });
        io.to(roomCode).emit('updatePlayers', room.players);
    });

    socket.on('movePlayer', (data) => {
        const room = rooms[data.roomCode];
        if (!room || !room.players[socket.id]) return;

        // Update position on server
        room.players[socket.id].position = data.position;
        
        // Broadcast to other players
        socket.to(data.roomCode).emit('movePlayer', { playerId: socket.id, position: data.position });
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        room.gameState = 'playing';
        room.roundActive = true;
        room.lavaHeight = 0;

        Object.keys(room.players).forEach((playerId, index) => {
            room.players[playerId].ladderStep = 0;
            room.players[playerId].isOut = false;
            room.players[playerId].position = { x: index * 2 - (Object.keys(room.players).length - 1), y: 0, z: 0 };
        });

        io.to(roomCode).emit('gameStarted', { players: room.players });
        startNewWord(roomCode);
        startLavaLoop(roomCode);
    });

    socket.on('submitWord', (data, callback) => {
        const { roomCode, typedWord } = data;
        const room = rooms[roomCode];
        if (!room || !room.roundActive) return;

        const player = room.players[socket.id];
        if (!player || player.isOut) return;

        if (typedWord.toLowerCase() === room.currentWord.toLowerCase()) {
            player.ladderStep += 1;
            callback({ success: true, correct: true });
            io.to(roomCode).emit('playerClimbed', { playerId: socket.id, step: player.ladderStep });
        } else {
            callback({ success: true, correct: false });
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        Object.keys(rooms).forEach((roomCode) => {
            const room = rooms[roomCode];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomCode).emit('updatePlayers', room.players);
            }
            if (room.hostId === socket.id) {
                io.to(roomCode).emit('roomClosed');
                delete rooms[roomCode];
            }
        });
    });
});

function startNewWord(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.roundActive) return;

    const randomIndex = Math.floor(Math.random() * room.wordList.length);
    room.currentWord = room.wordList[randomIndex].trim();
    io.to(roomCode).emit('newWord', { word: room.currentWord });
}

function startLavaLoop(roomCode) {
    const interval = setInterval(() => {
        // CRITICAL FIX: Look up the room inside the interval
        const room = rooms[roomCode];
        if (!room || !room.roundActive) {
            clearInterval(interval);
            return;
        }

        room.lavaHeight += room.lavaSpeed;
        let playersOutCount = 0;

        Object.keys(room.players).forEach((playerId) => {
            const player = room.players[playerId];
            if (player.ladderStep < room.lavaHeight && !player.isOut) {
                player.isOut = true;
                io.to(roomCode).emit('playerEliminated', { playerId: playerId });
            }
            if (player.isOut) playersOutCount++;
        });

        io.to(roomCode).emit('updateLava', { height: room.lavaHeight });

        if (playersOutCount === Object.keys(room.players).length) {
            room.roundActive = false;
            clearInterval(interval);
            io.to(roomCode).emit('gameOver', { winner: null });
        }

    }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});