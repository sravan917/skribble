// Global constants, shared utilities, sound effects
export const AVATARS = ['🐙', '🦄', '🦖', '🐸', '🐱', '🐶', '🐔', '🐷', '🦊', '🐻', '🐼', '🐯', '🦁', '🐵', '🐨', '🦉'];

export const state = {
    username: '',
    avatar: '🐶', // Default fallback
    roomId: null,
    isHost: false,
    players: [],
    gameSettings: {},
    myTurn: false,
    darkMode: false,
    soundEnabled: true
};

// Sound Effect Utility
export const sounds = {
    join: new Audio('/sounds/join.mp3'),
    leave: new Audio('/sounds/leave.mp3'),
    guess: new Audio('/sounds/guess.mp3'),
    start: new Audio('/sounds/start.mp3'),
    bell: new Audio('/sounds/bell.mp3'),
    win: new Audio('/sounds/win.mp3')
};

export function playSound(name) {
    if (state.soundEnabled && sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.log('Audio disabled by browser', e));
    }
}

export function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}
