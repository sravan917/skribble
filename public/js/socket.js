import { showScreen, updatePlayerList, updateSettingsUI } from './ui.js';
import { state, playSound } from './utils.js';
import { appendChatMessage, onGameStarted, onTurnPicking, onPickWordChoices, onTurnStart, onYourWord, onTurnEnd, onGameEnded } from './game.js';
import { drawExternalStep, startExternalDrawing, clearCanvasUI } from './canvas.js';

export const socket = io();

export function initSocketListeners() {
    // Rooms
    socket.on('roomJoined', (data) => {
        state.roomId = data.roomId;
        state.isHost = data.hostId === socket.id;
        document.getElementById('lobbyRoomIdDisplay').innerText = data.roomId;
        updateSettingsUI(data.settings);
        showScreen('lobby-screen');
    });

    socket.on('updatePlayerList', (data) => {
        updatePlayerList(data);
    });

    socket.on('playerJoined', (user) => {
        appendChatMessage({ type: 'system', message: `${user.avatar || '🐶'} ${user.username} joined.`});
        playSound('join');
    });

    socket.on('playerLeft', (user) => {
        appendChatMessage({ type: 'system', message: `${user.avatar || '🐶'} ${user.username} left.`});
        playSound('leave');
    });
    
    socket.on('settingsUpdated', (settings) => {
        updateSettingsUI(settings);
    });

    // Chat
    socket.on('chatMessage', (data) => {
        appendChatMessage(data);
        if(data.type !== 'system') {
            if (data.type === 'correct') playSound('bell');
            else playSound('guess');
        }
    });

    // Game Flow
    socket.on('gameStarted', (data) => {
        onGameStarted(data);
        playSound('start');
    });
    
    socket.on('turnPicking', onTurnPicking);
    socket.on('pickWordChoices', onPickWordChoices);
    socket.on('turnStart', onTurnStart);
    socket.on('yourWord', onYourWord);
    
    socket.on('timerUpdate', (t) => {
        document.getElementById('gameTimer').innerText = t;
    });

    socket.on('turnEnd', onTurnEnd);
    
    socket.on('gameEnded', (data) => {
        onGameEnded(data);
        playSound('win');
    });

    // Drawing
    socket.on('drawStart', startExternalDrawing);
    socket.on('drawing', drawExternalStep);
    socket.on('clearCanvas', clearCanvasUI);

    socket.on('error', (msg) => { alert(msg); });
}
