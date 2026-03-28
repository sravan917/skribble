import { state, escapeHTML } from './utils.js';
import { socket } from './socket.js';

// DOM Elements - Screens
export const screens = {
    home: document.getElementById('home-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

export function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        if(screen.id === screenId) {
            screen.classList.remove('hidden');
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        }
    });
}

export function updatePlayerList(data) {
    const list = document.getElementById('lobbyPlayerList');
    const gameList = document.getElementById('gamePlayerList');
    if(!list || !gameList) return;
    list.innerHTML = ''; gameList.innerHTML = '';
    
    document.getElementById('playerCount').innerText = data.players.length;
    state.players = data.players;
    state.isHost = data.hostId === socket.id;
    
    // Update lobby list
    data.players.forEach(p => {
        let li = document.createElement('li');
        const avatarStr = p.avatar || '🐶';
        li.innerHTML = `<div class="player-details">
            ${p.id === socket.id ? `<strong>${avatarStr} ${escapeHTML(p.username)} (You)</strong>` : `${avatarStr} ${escapeHTML(p.username)}`}
            ${p.id === data.hostId ? `<i class="fas fa-crown host-badge"></i>` : ''}
        </div>
        ${state.isHost && p.id !== socket.id ? `<button class="kick-btn" data-id="${p.id}"><i class="fas fa-ban"></i></button>` : ''}`;
        list.appendChild(li);
        
        // Ensure accurate state reflecting game actions
        let gli = document.createElement('li');
        gli.innerHTML = `
            <div class="player-details">
                ${p.avatar || '🐶'} ${escapeHTML(p.username)}
                ${p.id === state.drawerId ? ` <i class="fas fa-pencil-alt" style="margin-left:5px; font-size:0.8rem"></i>` : ''}
            </div>
            <strong>${p.score || 0}</strong>
        `;
        gameList.appendChild(gli);
    });
    
    if (state.isHost && screens.lobby.classList.contains('active')) {
        document.getElementById('startGameBtn').classList.remove('hidden');
        document.querySelectorAll('#lobby-screen select, #lobby-screen textarea').forEach(el => el.disabled = false);
    } else {
        document.getElementById('startGameBtn').classList.add('hidden');
        document.querySelectorAll('#lobby-screen select, #lobby-screen textarea').forEach(el => el.disabled = true);
    }
}

export function updateSettingsUI(settings) {
    if(!settings) return;
    document.getElementById('settingRounds').value = settings.rounds;
    document.getElementById('settingTime').value = settings.time;
    document.getElementById('settingDifficulty').value = settings.difficulty;
    document.getElementById('settingWordChoices').value = settings.wordChoices || 3;
    document.getElementById('settingCustomWords').value = settings.customWords;
}

// Listen to settings changes and emit to server
const settingsInputs = document.querySelectorAll('#lobby-screen select, #lobby-screen textarea');
settingsInputs.forEach(input => {
    input.addEventListener('change', () => {
        if(state.isHost) {
            const settings = {
                rounds: parseInt(document.getElementById('settingRounds').value) || 3,
                time: parseInt(document.getElementById('settingTime').value) || 90,
                difficulty: document.getElementById('settingDifficulty').value || 'medium',
                wordChoices: parseInt(document.getElementById('settingWordChoices').value) || 3,
                customWords: document.getElementById('settingCustomWords').value || ''
            };
            socket.emit('updateSettings', settings);
        }
    });
});

// Host Lobby Controls
document.getElementById('startGameBtn').addEventListener('click', () => {
    if(state.isHost) socket.emit('startGame');
});

// Global UI controls
document.getElementById('themeToggleBtn').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
    } else {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
    }
});

const soundToggleBtn = document.getElementById('soundToggleBtn');
soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    soundToggleBtn.innerHTML = state.soundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
});
