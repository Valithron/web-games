import { mountGameShell } from '/shared/game-shell.js';
import { createEscapeeInput } from '/shared/input.js';
import { createEscapeeStorage } from '/shared/storage.js';

mountGameShell({ title: 'New Game' });
const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d');
const input = createEscapeeInput({ surface: canvas, joystick: document.querySelector('#joystick'), primary: document.querySelector('#primary') });
const storage = createEscapeeStorage('new-game');
let player = { x: 0, y: 0, radius: 18 };
let paused = false;
let last = performance.now();

function resize() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (!player.x) { player.x = rect.width / 2; player.y = rect.height / 2; }
}

function restart() {
  const rect = canvas.getBoundingClientRect();
  player.x = rect.width / 2;
  player.y = rect.height / 2;
  storage.set('lastPlayed', new Date().toISOString());
}

window.EscapeeGame = { restart, pause: () => paused = true, resume: () => { paused = false; last = performance.now(); }, setMuted() {} };
addEventListener('resize', resize);
resize();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!paused) {
    const rect = canvas.getBoundingClientRect();
    player.x = Math.max(player.radius, Math.min(rect.width - player.radius, player.x + input.axisX * 220 * dt));
    player.y = Math.max(player.radius, Math.min(rect.height - player.radius, player.y + input.axisY * 220 * dt));
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = '#10264d'; context.fillRect(0, 0, rect.width, rect.height);
    context.fillStyle = '#f0a72f'; context.beginPath(); context.arc(player.x, player.y, player.radius + (input.primary ? 6 : 0), 0, Math.PI * 2); context.fill();
    context.fillStyle = '#fffaf0'; context.font = '700 16px Arial'; context.textAlign = 'center'; context.fillText('Move with WASD, arrows, or touch', rect.width / 2, 38);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
