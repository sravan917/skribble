import { state, AVATARS } from './utils.js';
import { initSocketListeners, socket } from './socket.js';
import { initCanvas } from './canvas.js';
import './ui.js';
import './game.js';

document.addEventListener('DOMContentLoaded', () => {
    initSocketListeners();
    initCanvas();

    // Home Screen Actions
    const createBtn = document.getElementById('createRoomBtn');
    const usernameInput = document.getElementById('usernameInput');
    const joinRoomIdInput = document.getElementById('joinRoomIdInput');

    // Initialize Avatar Picker
    const avatarPicker = document.getElementById('avatarPicker');
    if (avatarPicker) {
        // Randomize default
        state.avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        
        AVATARS.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = `avatar-btn ${emoji === state.avatar ? 'selected' : ''}`;
            btn.innerText = emoji;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.avatar = emoji;
            });
            avatarPicker.appendChild(btn);
        });
    }

    createBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if(!username) return alert('Enter a name');
        state.username = username;
        socket.emit('createRoom', { username, avatar: state.avatar });
    });

    // "Join Room" button on home screen opens the modal
    // The inline onclick already handles showing the modal
    // But we also need: if URL has ?room=, auto-open the modal
    const joinModal = document.getElementById('joinModal');

    // The actual join submit from the modal
    const joinSubmitBtn = document.getElementById('joinRoomSubmitBtn');
    joinSubmitBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const roomId = joinRoomIdInput.value.trim();
        if(!username) {
            joinModal.classList.add('hidden');
            usernameInput.focus();
            return alert('Enter your name first');
        }
        if(!roomId) return alert('Enter a room code');
        state.username = username;
        socket.emit('joinRoom', { roomId, username, avatar: state.avatar });
    });

    // Allow pressing Enter in the room code input
    joinRoomIdInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            joinSubmitBtn.click();
        }
    });

    // Close modal on overlay click (outside the panel)
    joinModal.addEventListener('click', (e) => {
        if(e.target === joinModal) {
            joinModal.classList.add('hidden');
        }
    });
    
    // Copy invite link
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        if(state.roomId) {
            const link = `${window.location.origin}/?room=${state.roomId}`;
            navigator.clipboard.writeText(link);
            alert('Invite link copied!');
        }
    });
    
    // Auto-fill room ID if provided in URL — auto open join modal
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if(roomFromUrl) {
        joinRoomIdInput.value = roomFromUrl;
        joinModal.classList.remove('hidden');
    }

    // Lobby interactions
    document.getElementById('lobbyPlayerList').addEventListener('click', (e) => {
        const kickBtn = e.target.closest('.kick-btn');
        if(kickBtn && state.isHost) {
            socket.emit('kickPlayer', kickBtn.dataset.id);
        }
    });

    // Result screen integrations
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        if(state.isHost) socket.emit('startGame');
    });

    document.getElementById('backToLobbyBtn').addEventListener('click', () => {
        window.location.href = '/?room=' + state.roomId;
    });

    // Export History
    document.getElementById('exportHistoryBtn').addEventListener('click', () => {
        const msgs = Array.from(document.querySelectorAll('.chat-msg')).map(el => el.innerText).join('\n');
        const blob = new Blob([msgs || 'No chat history'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skribble_history_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Stats
    document.getElementById('statsBtn').addEventListener('click', () => {
        const stats = JSON.parse(localStorage.getItem('skribble-stats') || '{"games":0, "wins":0}');
        alert(`Your Stats:\nGames Played: ${stats.games}\nWins: ${stats.wins}`);
    });

    // Animate stats counters on home screen
    animateStats();
});

function animateStats() {
    animateCounter('onlineCount', 847, 2000);
    animateCounter('sketchCount', 12400, 2500);
}

function animateCounter(elementId, target, duration) {
    const el = document.getElementById(elementId);
    if(!el) return;
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * eased);
        
        if(target >= 1000) {
            el.innerText = (current / 1000).toFixed(1) + 'k';
        } else {
            el.innerText = current.toLocaleString();
        }
        
        if(progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}
