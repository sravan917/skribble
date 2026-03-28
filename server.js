const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

let wordsDb = { easy: [], medium: [], hard: [] };
try { wordsDb = require('./utils/words'); } catch(e) { console.error("Could not load words.js"); }

const rooms = {};
const socketToRoom = {};

function generateRoomId() { return crypto.randomBytes(3).toString('hex').toUpperCase(); }

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getWordPool(room) {
    let pool = [];
    if (room.settings.customWords) {
        pool = room.settings.customWords.split(',').map(w => w.trim()).filter(w => w);
    }
    if (pool.length < 5) pool = pool.concat(wordsDb[room.settings.difficulty] || wordsDb.medium);
    return pool;
}

function pickRandomWords(room, count) {
    let pool = getWordPool(room).filter(w => !room.game.usedWords.includes(w));
    if (pool.length < count) pool = getWordPool(room); // reset if ran out
    pool = shuffle(pool);
    return pool.slice(0, count);
}

function startTimer(roomId, seconds, onTick, onEnd) {
    const room = rooms[roomId];
    if(!room) return;
    room.game.timeLeft = seconds;
    clearInterval(room.game.interval);
    room.game.interval = setInterval(() => {
        room.game.timeLeft--;
        if(onTick) onTick(room.game.timeLeft);
        if(room.game.timeLeft <= 0) {
            clearInterval(room.game.interval);
            if(onEnd) onEnd();
        }
    }, 1000);
}

function startGame(roomId) {
    const room = rooms[roomId];
    if(!room) return;
    room.status = 'playing';
    room.game.currentRound = 1;
    room.game.currentPlayerIndex = 0;
    room.game.usedWords = [];
    room.players.forEach(p => p.score = 0);
    
    io.to(roomId).emit('gameStarted', { rounds: room.settings.rounds });
    io.to(roomId).emit('updatePlayerList', { players: room.players, hostId: room.host }); // updates scores
    startTurn(roomId);
}

function startTurn(roomId) {
    const room = rooms[roomId];
    if(!room || room.players.length === 0) return;
    
    room.status = 'picking';
    room.game.guessedCorrectly = [];
    room.game.drawerId = room.players[room.game.currentPlayerIndex].id;
    
    const wordChoiceCount = room.settings.wordChoices || 3;
    const wordChoices = pickRandomWords(room, wordChoiceCount);
    io.to(roomId).emit('clearCanvas');
    io.to(roomId).emit('turnPicking', { 
        drawerId: room.game.drawerId,
        drawerName: room.players[room.game.currentPlayerIndex].username,
        drawerAvatar: room.players[room.game.currentPlayerIndex].avatar || '🐶',
        round: room.game.currentRound,
        totalRounds: room.settings.rounds
    });
    
    // Only send word choices to the drawer
    io.to(room.game.drawerId).emit('pickWordChoices', wordChoices);
    
    startTimer(roomId, 15, 
        (t) => { io.to(roomId).emit('timerUpdate', t); },
        () => { wordChosen(roomId, wordChoices[0], null); } // Auto pick on timeout
    );
}

function wordChosen(roomId, word, socket = null) {
    const room = rooms[roomId];
    if(!room || room.status !== 'picking') return;
    clearInterval(room.game.interval);
    
    room.status = 'drawing';
    room.game.currentWord = word;
    room.game.usedWords.push(word);
    
    const hint = word.replace(/[a-zA-Z]/g, '_ ').trim();
    
    io.to(roomId).emit('turnStart', { hint });
    io.to(room.game.drawerId).emit('yourWord', word);
    
    startTimer(roomId, room.settings.time, 
        (t) => { io.to(roomId).emit('timerUpdate', t); },
        () => { endTurn(roomId); }
    );
}

function endTurn(roomId) {
    const room = rooms[roomId];
    if(!room) return;
    clearInterval(room.game.interval);
    
    room.status = 'roundResult';
    io.to(roomId).emit('turnEnd', { word: room.game.currentWord });
    io.to(roomId).emit('updatePlayerList', { players: room.players, hostId: room.host });
    
    startTimer(roomId, 5, 
        (t) => { io.to(roomId).emit('timerUpdate', t); },
        () => {
            room.game.currentPlayerIndex++;
            if (room.game.currentPlayerIndex >= room.players.length) {
                room.game.currentPlayerIndex = 0;
                room.game.currentRound++;
            }
            
            if (room.game.currentRound > room.settings.rounds) {
                endGame(roomId);
            } else {
                startTurn(roomId);
            }
        }
    );
}

function endGame(roomId) {
    const room = rooms[roomId];
    if(!room) return;
    room.status = 'lobby';
    room.players.sort((a,b) => b.score - a.score); // highest score first
    
    clearInterval(room.game.interval);
    io.to(roomId).emit('gameEnded', { players: room.players });
}

io.on('connection', (socket) => {
    
    socket.on('createRoom', ({ username, avatar }) => {
        let roomId = generateRoomId();
        while(rooms[roomId]) roomId = generateRoomId();

        rooms[roomId] = {
            id: roomId,
            host: socket.id,
            players: [{ id: socket.id, username, avatar: avatar || '🐶', score: 0 }],
            settings: { rounds: 3, time: 90, difficulty: 'medium', wordChoices: 3, customWords: '' },
            status: 'lobby',
            game: { currentRound: 0, currentPlayerIndex: 0, usedWords: [], currentWord: '', timeLeft: 0, drawerId: null, guessedCorrectly: [], interval: null }
        };
        
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;
        socket.emit('roomJoined', { roomId, hostId: socket.id, players: rooms[roomId].players, settings: rooms[roomId].settings });
        io.to(roomId).emit('updatePlayerList', { players: rooms[roomId].players, hostId: socket.id });
    });

    socket.on('joinRoom', ({ roomId, username, avatar }) => {
        roomId = roomId.toUpperCase();
        if (!rooms[roomId]) return socket.emit('error', 'Room not found.');
        if (rooms[roomId].status !== 'lobby') return socket.emit('error', 'Game already started.');
        if (rooms[roomId].players.length >= 10) return socket.emit('error', 'Room is full.');
        if (rooms[roomId].players.find(p => p.username === username)) return socket.emit('error', 'Username taken.');

        rooms[roomId].players.push({ id: socket.id, username, avatar: avatar || '🐶', score: 0 });
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;
        socket.emit('roomJoined', { roomId, hostId: rooms[roomId].host, players: rooms[roomId].players, settings: rooms[roomId].settings });
        socket.to(roomId).emit('playerJoined', { id: socket.id, username, avatar: avatar || '🐶' });
        io.to(roomId).emit('updatePlayerList', { players: rooms[roomId].players, hostId: rooms[roomId].host });
    });

    socket.on('updateSettings', (settings) => {
        const roomId = socketToRoom[socket.id];
        if (roomId && rooms[roomId] && rooms[roomId].host === socket.id) {
            rooms[roomId].settings = settings;
            socket.to(roomId).emit('settingsUpdated', settings);
        }
    });

    socket.on('startGame', () => {
        const roomId = socketToRoom[socket.id];
        if (roomId && rooms[roomId] && rooms[roomId].host === socket.id) {
            startGame(roomId);
        }
    });

    socket.on('wordChosen', (word) => {
        const roomId = socketToRoom[socket.id];
        if (roomId && rooms[roomId] && rooms[roomId].game.drawerId === socket.id) {
            wordChosen(roomId, word, socket);
        }
    });

    socket.on('chatMessage', ({ roomId, message }) => {
        const room = rooms[roomId];
        if(!room || !message.trim()) return;
        const player = room.players.find(p => p.id === socket.id);
        if(!player) return;

        // Block the drawer from chatting during drawing phase
        if (room.status === 'drawing' && room.game.drawerId === socket.id) {
            socket.emit('chatMessage', { type: 'system', message: 'You cannot chat while drawing!' });
            return;
        }

        if (room.status === 'drawing' && !room.game.guessedCorrectly.includes(socket.id)) {
            if (message.toLowerCase().trim() === room.game.currentWord.toLowerCase()) {
                room.game.guessedCorrectly.push(socket.id);
                
                const points = Math.max(10, Math.floor((room.game.timeLeft / room.settings.time) * 100));
                player.score += points;
                
                const drawer = room.players.find(p => p.id === room.game.drawerId);
                if (drawer) drawer.score += Math.floor(points / 2);

                io.to(roomId).emit('chatMessage', { type: 'correct', username: player.username, avatar: player.avatar || '🐶' });
                io.to(roomId).emit('updatePlayerList', { players: room.players, hostId: room.host });

                if (room.game.guessedCorrectly.length >= room.players.length - 1) {
                    endTurn(roomId);
                }
                return; // Suppress chat message from showing the correct word
            } else if (room.game.currentWord.length >= 3 && message.toLowerCase().includes(room.game.currentWord.toLowerCase().substring(0, 3))) {
                socket.emit('chatMessage', { type: 'system', message: `'${message}' is close!` });
            }
        }
        io.to(roomId).emit('chatMessage', { type: 'chat', username: player.username, avatar: player.avatar || '🐶', message });
    });

    socket.on('drawStart', (data) => { socket.to(data.roomId).emit('drawStart', data); });
    socket.on('drawing', (data) => { socket.to(data.roomId).emit('drawing', data); });
    socket.on('clearCanvas', (roomId) => { socket.to(roomId).emit('clearCanvas'); });
    socket.on('skipWord', () => { 
        const roomId = socketToRoom[socket.id];
        if(!roomId) return;
        const room = rooms[roomId];
        if(room && room.status === 'drawing' && (socket.id === room.game.drawerId || socket.id === room.host)) {
            io.to(roomId).emit('chatMessage', { type: 'system', message: 'Word skipped.' });
            endTurn(roomId);
        }
    });
    socket.on('kickPlayer', (playerId) => {
        const roomId = socketToRoom[socket.id];
        if(roomId && rooms[roomId] && rooms[roomId].host === socket.id) {
            io.sockets.sockets.get(playerId)?.disconnect();
        }
    });

    socket.on('disconnect', () => {
        const roomId = socketToRoom[socket.id];
        if (roomId && rooms[roomId]) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if(playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                socket.to(roomId).emit('playerLeft', player);

                if(room.players.length === 0) {
                    clearInterval(room.game.interval);
                    delete rooms[roomId];
                } else {
                    if (room.host === socket.id) {
                        room.host = room.players[0].id;
                    }
                    io.to(roomId).emit('updatePlayerList', { players: room.players, hostId: room.host }); // Ensure updated scores & host are reflected

                    if(room.status !== 'lobby' && room.status !== 'roundResult' && room.game.drawerId === socket.id) {
                        // Current drawer disconnected
                        endTurn(roomId);
                    } else if(room.status === 'drawing' && room.game.guessedCorrectly.length >= room.players.length - 1) {
                        endTurn(roomId);
                    }
                }
            }
        }
        delete socketToRoom[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
