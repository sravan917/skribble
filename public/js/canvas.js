import { socket } from './socket.js';
import { state } from './utils.js';

const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const colorPalette = document.getElementById('colorPalette');
const toolSizePicker = document.getElementById('toolSize');
const canvasContainer = document.getElementById('canvasContainer');

let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#000000';
let currentSize = 5;

// Throttle events
let lastEmit = Date.now();

// Setup colors
const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffa500', '#800080', '#00ffff'];

export function initCanvas() {
    // Resize canvas to match CSS layout
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Build palette
    colorPalette.innerHTML = '';
    colors.forEach(color => {
        const btn = document.createElement('div');
        btn.classList.add('color-btn');
        btn.style.backgroundColor = color;
        if (color === currentColor) btn.classList.add('active');
        btn.onclick = () => {
            currentColor = color;
            currentTool = 'pen';
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        colorPalette.appendChild(btn);
    });

    // Tool logic
    const penBtn = document.getElementById('toolPen');
    const eraserBtn = document.getElementById('toolEraser');
    const clearBtn = document.getElementById('toolClear');

    penBtn.onclick = () => { currentTool = 'pen'; penBtn.classList.add('active'); eraserBtn.classList.remove('active'); };
    eraserBtn.onclick = () => { currentTool = 'eraser'; eraserBtn.classList.add('active'); penBtn.classList.remove('active'); };
    clearBtn.onclick = () => { if (state.myTurn) { ctx.clearRect(0,0,canvas.width,canvas.height); socket.emit('clearCanvas', state.roomId); }};
    toolSizePicker.onchange = (e) => { currentSize = e.target.value; };

    // Drawing state
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) };
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('touchend', endDrawing);
canvas.addEventListener('mouseout', endDrawing);

function startDrawing(e) {
    if (!state.myTurn) return;
    isDrawing = true;
    const {x, y} = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // emit start
    socket.emit('drawStart', { roomId: state.roomId, x, y, color: currentTool === 'eraser' ? '#ffffff' : currentColor, size: currentSize });
}

function draw(e) {
    if (!isDrawing || !state.myTurn) return;
    e.preventDefault();
    const {x, y} = getPos(e);
    const colorToUse = currentTool === 'eraser' ? '#ffffff' : currentColor;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = colorToUse;
    ctx.lineWidth = currentSize;
    ctx.stroke();

    const now = Date.now();
    if (now - lastEmit > 20) { // Limit to 50 updates/second
        socket.emit('drawing', { roomId: state.roomId, x, y, color: colorToUse, size: currentSize });
        lastEmit = now;
    }
}

function endDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.closePath();
}

// External drawing integration
export function drawExternalStep(data) {
    ctx.lineTo(data.x, data.y);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.stroke();
}

export function startExternalDrawing(data) {
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
}

export function clearCanvasUI() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
}
