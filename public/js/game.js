import { state, escapeHTML } from './utils.js';
import { clearCanvasUI, initCanvas } from './canvas.js';
import { socket } from './socket.js';
import { showScreen } from './ui.js';

// Chat logic
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatHistory = document.getElementById('chatHistory');

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if(msg && state.roomId) {
        socket.emit('chatMessage', { roomId: state.roomId, message: msg });
        chatInput.value = '';
    }
});

export function appendChatMessage(msgData) {
    const div = document.createElement('div');
    div.classList.add('chat-msg');
    
    if (msgData.type === 'system') {
        div.classList.add('system');
        div.innerText = msgData.message;
    } else if (msgData.type === 'correct') {
        div.classList.add('correct');
        div.innerText = `${msgData.avatar || '🐶'} ${msgData.username} guessed the word!`;
    } else {
        if (msgData.username === state.username) {
            div.innerHTML = `<b>${state.avatar || '🐶'} You:</b> ${escapeHTML(msgData.message)}`;
        } else {
            div.innerHTML = `<b>${msgData.avatar || '🐶'} ${escapeHTML(msgData.username)}:</b> ${escapeHTML(msgData.message)}`;
        }
    }
    
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Emotes simple implementation
document.getElementById('emojiBtn').addEventListener('click', () => {
    chatInput.value += '😂';
    chatInput.focus();
});

// Game state handlers
export function onGameStarted(data) {
    showScreen('game-screen');
    // Re-initialize canvas now that the game screen is visible and has real dimensions
    setTimeout(() => { initCanvas(); }, 50);
    document.getElementById('chatHistory').innerHTML = ''; // clear chat
    appendChatMessage({ type: 'system', message: 'Game started!' });
}

export function onTurnPicking(data) {
    state.drawerId = data.drawerId;
    state.myTurn = (data.drawerId === socket.id);
    document.getElementById('gameRoundDisplay').innerText = `${data.round}/${data.totalRounds}`;
    document.getElementById('gameWordHint').innerText = 'WAITING...';
    clearCanvasUI();
    
    if (state.myTurn) {
        document.getElementById('wordSelectionOverlay').classList.remove('hidden');
        appendChatMessage({ type: 'system', message: `It's your turn to draw!`});
        document.getElementById('canvasContainer').classList.add('my-turn');
        // Disable chat for the drawer
        chatInput.disabled = true;
        chatInput.placeholder = 'You are drawing...';
    } else {
        document.getElementById('wordSelectionOverlay').classList.add('hidden');
        appendChatMessage({ type: 'system', message: `${data.drawerAvatar || '🐶'} ${data.drawerName} is picking a word...`});
        document.getElementById('canvasContainer').classList.remove('my-turn');
        // Enable chat for guessers
        chatInput.disabled = false;
        chatInput.placeholder = 'Guess the word...';
    }
}

export function onPickWordChoices(choices) {
    const container = document.getElementById('wordChoices');
    container.innerHTML = '';
    choices.forEach(word => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerText = word;
        btn.onclick = () => {
            socket.emit('wordChosen', word);
            document.getElementById('wordSelectionOverlay').classList.add('hidden');
        };
        container.appendChild(btn);
    });
}

export function onTurnStart(data) {
    document.getElementById('wordSelectionOverlay').classList.add('hidden');
    document.getElementById('gameWordHint').innerText = data.hint;
    clearCanvasUI();
    if (!state.myTurn) {
        appendChatMessage({ type: 'system', message: `Drawing started!` });
    }
}

export function onYourWord(word) {
    document.getElementById('gameWordHint').innerText = word;
}

export function onTurnEnd(data) {
    appendChatMessage({ type: 'system', message: `Round over! The word was: ${data.word}` });
    // Re-enable chat for everyone between turns
    chatInput.disabled = false;
    chatInput.placeholder = 'Guess the word...';
    state.myTurn = false;
}

export function onGameEnded(data) {
    showScreen('result-screen');
    const winner = data.players[0];
    document.getElementById('winnerName').innerText = winner ? winner.username : 'No one';
    
    // Record Stats locally
    const stats = JSON.parse(localStorage.getItem('skribble-stats') || '{"games":0, "wins":0}');
    stats.games++;
    if (winner && winner.id === socket.id) stats.wins++;
    localStorage.setItem('skribble-stats', JSON.stringify(stats));

    const list = document.getElementById('finalScoreList');
    list.innerHTML = '';
    data.players.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.avatar || '🐶'} ${escapeHTML(p.username)}</span> <span>${p.score}</span>`;
        list.appendChild(li);
    });
    
    if(state.isHost) {
        document.getElementById('playAgainBtn').classList.remove('hidden');
        document.getElementById('backToLobbyBtn').classList.remove('hidden');
    }
    
    // Confetti
    triggerConfetti();
}

function triggerConfetti() {
    // We can use a simple confetti logic or just show the canvas
    const canvas = document.getElementById('confettiCanvas');
    canvas.classList.remove('hidden');
    // For MVP, just show the canvas and hide after 5 seconds
    setTimeout(() => canvas.classList.add('hidden'), 5000);
}

// Controls
document.getElementById('toolSkip').addEventListener('click', () => {
    socket.emit('skipWord');
});
