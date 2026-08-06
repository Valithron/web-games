import { CFG, createMatch, step, canPlace, pocketFor } from './simulation.js';

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const start = document.querySelector('#start');
const hud = document.querySelector('#hud');
const tray = document.querySelector('#tray');
const shop = document.querySelector('#shop');
const result = document.querySelector('#result');
const buildBtn = document.querySelector('#buildBtn');
const abilityBtn = document.querySelector('#abilityBtn');
const joystick = document.querySelector('#joystick');
const controlHint = document.querySelector('#controlHint');
const placementStatus = document.querySelector('#placementStatus');

const defs = CFG.structures;
const structureKeys = Object.keys(defs);
const movementCodes = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
]);

let W = 1;
let H = 1;
let D = 1;
let state = null;
let role = null;
let paused = false;
let last = performance.now();
let acc = 0;
let selected = 'wall';
let camera = { x: 0, y: 0 };
let pointer = { x: 0, y: 0 };
let placing = false;
let noticeTimer = 0;
let shopSignature = '';

const keys = new Set();
const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  D = Math.min(devicePixelRatio || 1, 2);
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  canvas.width = Math.round(W * D);
  canvas.height = Math.round(H * D);
  ctx.setTransform(D, 0, 0, D, 0, 0);
}

function resetInputs() {
  keys.clear();
  stick.id = null;
  stick.x = 0;
  stick.y = 0;
}

function setNotice(message, seconds = 2.2) {
  placementStatus.textContent = message;
  placementStatus.classList.remove('hidden');
  noticeTimer = seconds;
}

function clearNotice() {
  placementStatus.classList.add('hidden');
  placementStatus.textContent = '';
  noticeTimer = 0;
}

function updateRoleControls() {
  if (role === 'builder') {
    controlHint.textContent = 'Move: WASD / arrows · Build: B or Space · Select: 1–5 · Place: click a grid cell';
    buildBtn.classList.remove('hidden');
    abilityBtn.classList.add('hidden');
  } else {
    controlHint.textContent = 'Move: WASD / arrows · Dash: Space · Attacks are automatic · Upgrade at the center shop';
    buildBtn.classList.add('hidden');
    abilityBtn.classList.remove('hidden');
  }
}

function begin(nextRole) {
  role = nextRole;
  state = createMatch(nextRole, 7);
  paused = false;
  placing = false;
  selected = 'wall';
  acc = 0;
  last = performance.now();
  shopSignature = '';
  clearNotice();
  resetInputs();

  const focus = role === 'hunter' ? state.hunter : state.builders[0];
  camera.x = focus.x;
  camera.y = focus.y;

  start.classList.add('hidden');
  result.classList.add('hidden');
  hud.classList.remove('hidden');
  joystick.classList.remove('hidden');
  tray.classList.add('hidden');
  shop.classList.add('hidden');
  updateRoleControls();
  updateBuildButtons();
}

function returnToRoleSelect() {
  state = null;
  placing = false;
  resetInputs();
  result.classList.add('hidden');
  hud.classList.add('hidden');
  joystick.classList.add('hidden');
  buildBtn.classList.add('hidden');
  abilityBtn.classList.add('hidden');
  tray.classList.add('hidden');
  shop.classList.add('hidden');
  clearNotice();
  start.classList.remove('hidden');
}

function enterPlacement(type) {
  if (!state || role !== 'builder' || !state.builders[0]?.alive) return;
  selected = type;
  placing = true;
  tray.classList.add('hidden');
  updateBuildButtons();
  setNotice(`${defs[type].name} selected. Click a highlighted cell to place.`, 3);
}

function toggleBuildMenu() {
  if (!state || role !== 'builder' || !state.builders[0]?.alive) return;
  placing = false;
  tray.classList.toggle('hidden');
  updateBuildButtons();
  if (!tray.classList.contains('hidden')) setNotice('Choose a structure or press 1–5.', 2.5);
}

function buildTray() {
  tray.innerHTML = '';
  structureKeys.forEach((key, index) => {
    const def = defs[key];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.structure = key;
    button.innerHTML = `<strong>${index + 1}. ${def.name}</strong><span>${def.m} M · ${def.c} C</span>`;
    button.addEventListener('click', () => enterPlacement(key));
    tray.append(button);
  });
}

function updateBuildButtons() {
  if (!state || role !== 'builder') return;
  const builder = state.builders[0];
  tray.querySelectorAll('[data-structure]').forEach(button => {
    const def = defs[button.dataset.structure];
    const affordable = builder.m >= def.m && builder.c >= def.c;
    button.disabled = !affordable || !builder.alive;
    button.classList.toggle('selected', button.dataset.structure === selected);
    button.setAttribute('aria-pressed', String(button.dataset.structure === selected));
  });
  buildBtn.textContent = placing ? `Place ${defs[selected].name}` : 'Build';
}

function shopUi() {
  if (!state) return;
  const signature = `${Math.floor(state.hunter.bounty)}:${JSON.stringify(state.hunter.level)}`;
  if (signature === shopSignature) return;
  shopSignature = signature;
  shop.innerHTML = '';

  for (const [key, name] of [
    ['damage', 'Weapon'],
    ['hp', 'Vitality'],
    ['speed', 'Speed'],
    ['siege', 'Siege'],
    ['bounty', 'Bounty']
  ]) {
    const level = state.hunter.level[key] || 0;
    const cost = 70 + level * 65;
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = state.hunter.bounty < cost;
    button.innerHTML = `<strong>${name} ${level + 1}</strong><span>${cost} bounty</span>`;
    button.addEventListener('click', () => {
      state._buy = key;
      shopSignature = '';
    });
    shop.append(button);
  }
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  return pointer;
}

function placementCell() {
  const wx = pointer.x + camera.x - W / 2;
  const wy = pointer.y + camera.y - H / 2;
  return { gx: Math.floor(wx / CFG.cell), gy: Math.floor(wy / CFG.cell) };
}

function canAffordSelected() {
  const builder = state?.builders[0];
  const def = defs[selected];
  return Boolean(builder && builder.m >= def.m && builder.c >= def.c);
}

function handleCanvasPlacement(event) {
  pointerPosition(event);
  if (!state || paused || state.winner || role !== 'builder' || !placing) return;

  const builder = state.builders[0];
  const { gx, gy } = placementCell();

  if (!canAffordSelected()) {
    setNotice(`Not enough resources for ${defs[selected].name}.`);
    return;
  }
  if (!canPlace(state, builder, selected, gx, gy)) {
    setNotice('That grid cell is blocked or outside your holdfast.');
    return;
  }

  state._place = { gx, gy, structure: selected };
  setNotice(`${defs[selected].name} placed. Click again to place another, or press B to close.`, 2.4);
}

function handleKeyDown(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (movementCodes.has(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }

  if (!state || paused || state.winner) return;

  if (role === 'builder') {
    if (event.code === 'KeyB' || event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) toggleBuildMenu();
      return;
    }

    if (/^Digit[1-5]$/.test(event.code)) {
      event.preventDefault();
      const index = Number(event.code.slice(-1)) - 1;
      const type = structureKeys[index];
      if (type && !event.repeat) enterPlacement(type);
      return;
    }

    if (event.code === 'KeyQ' && placing) {
      event.preventDefault();
      placing = false;
      tray.classList.add('hidden');
      setNotice('Placement cancelled.');
    }
  } else if (role === 'hunter' && event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) state._dash = true;
  }
}

function handleKeyUp(event) {
  keys.delete(event.code);
}

function joystickDown(event) {
  stick.id = event.pointerId;
  stick.ox = event.clientX;
  stick.oy = event.clientY;
  joystick.setPointerCapture?.(event.pointerId);
}

function joystickMove(event) {
  if (event.pointerId !== stick.id) return;
  stick.x = Math.max(-1, Math.min(1, (event.clientX - stick.ox) / 40));
  stick.y = Math.max(-1, Math.min(1, (event.clientY - stick.oy) / 40));
}

function joystickRelease(event) {
  if (stick.id !== event.pointerId) return;
  stick.id = null;
  stick.x = 0;
  stick.y = 0;
}

function commandsForTick() {
  if (!state) return [];

  const x = Number(keys.has('KeyD') || keys.has('ArrowRight'))
    - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stick.x;
  const y = Number(keys.has('KeyS') || keys.has('ArrowDown'))
    - Number(keys.has('KeyW') || keys.has('ArrowUp')) + stick.y;
  const commands = [];

  if (x || y) commands.push({ type: 'move', actor: role === 'hunter' ? 'hunter' : 0, x, y });
  if (state._dash) {
    commands.push({ type: 'dash' });
    state._dash = false;
  }
  if (state._buy) {
    commands.push({ type: 'buy', key: state._buy });
    state._buy = null;
  }
  if (state._place) {
    commands.push({ type: 'place', actor: 0, ...state._place });
    state._place = null;
  }

  return commands;
}

function screen(x, y) {
  return { x: x - camera.x + W / 2, y: y - camera.y + H / 2 };
}

function drawTerrain() {
  ctx.fillStyle = '#111b20';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 - camera.x, H / 2 - camera.y);
  ctx.fillStyle = '#26352f';
  ctx.fillRect(0, 0, 38 * CFG.cell, 34 * CFG.cell);
  ctx.fillStyle = '#10171b';

  const terrainRects = [
    { x: 0, y: 0, w: 38, h: 2 },
    { x: 0, y: 32, w: 38, h: 2 },
    { x: 0, y: 0, w: 2, h: 34 },
    { x: 36, y: 0, w: 2, h: 34 },
    { x: 13, y: 2, w: 11, h: 8 },
    { x: 12, y: 10, w: 4, h: 11 },
    { x: 22, y: 10, w: 4, h: 11 },
    { x: 12, y: 21, w: 4, h: 11 },
    { x: 22, y: 21, w: 4, h: 11 }
  ];
  for (const rect of terrainRects) {
    ctx.fillRect(rect.x * CFG.cell, rect.y * CFG.cell, rect.w * CFG.cell, rect.h * CFG.cell);
  }

  ctx.strokeStyle = '#5b7164';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const pocket = pocketFor(i);
    ctx.strokeRect(pocket.x * CFG.cell, pocket.y * CFG.cell, pocket.w * CFG.cell, pocket.h * CFG.cell);
  }
  ctx.restore();
}

function drawStructure(structure) {
  if (!structure.alive) return;
  const point = screen(structure.x, structure.y);
  ctx.fillStyle = {
    wall: '#698078',
    material: '#59b886',
    charge: '#63a7c9',
    turret: '#d7b95c',
    repair: '#a989d0'
  }[structure.type];
  ctx.fillRect(point.x - structure.w * 15, point.y - structure.h * 15, structure.w * 30, structure.h * 30);
  ctx.fillStyle = '#0b1115';
  ctx.fillRect(point.x - 16, point.y - structure.h * 18, 32, 4);
  ctx.fillStyle = '#a6e2b9';
  ctx.fillRect(point.x - 16, point.y - structure.h * 18, 32 * Math.max(0, structure.hp / structure.maxHp), 4);
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(structure.tier, point.x, point.y + 3);
}

function drawEntity(entity) {
  if (!entity.alive) return;
  const point = screen(entity.x, entity.y);
  ctx.fillStyle = entity.kind === 'hunter' ? '#e66d43' : (entity.ai ? '#9dd8bd' : '#f4fbf7');
  ctx.beginPath();
  ctx.arc(point.x, point.y, entity.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#071014';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#0b1115';
  ctx.fillRect(point.x - 18, point.y - entity.r - 9, 36, 4);
  ctx.fillStyle = entity.kind === 'hunter' ? '#f59a76' : '#b9efcf';
  ctx.fillRect(point.x - 18, point.y - entity.r - 9, 36 * Math.max(0, entity.hp / entity.maxHp), 4);
}

function drawPlacement() {
  if (!placing || role !== 'builder' || !state?.builders[0]?.alive) return;
  const builder = state.builders[0];
  const pocket = pocketFor(builder.pocket);

  ctx.save();
  ctx.translate(W / 2 - camera.x, H / 2 - camera.y);
  ctx.strokeStyle = '#a8d9c044';
  ctx.lineWidth = 1;
  for (let gx = pocket.x; gx <= pocket.x + pocket.w; gx += 1) {
    ctx.beginPath();
    ctx.moveTo(gx * CFG.cell, pocket.y * CFG.cell);
    ctx.lineTo(gx * CFG.cell, (pocket.y + pocket.h) * CFG.cell);
    ctx.stroke();
  }
  for (let gy = pocket.y; gy <= pocket.y + pocket.h; gy += 1) {
    ctx.beginPath();
    ctx.moveTo(pocket.x * CFG.cell, gy * CFG.cell);
    ctx.lineTo((pocket.x + pocket.w) * CFG.cell, gy * CFG.cell);
    ctx.stroke();
  }
  ctx.restore();

  const { gx, gy } = placementCell();
  const def = defs[selected];
  const valid = canAffordSelected() && canPlace(state, builder, selected, gx, gy);
  const point = screen((gx + def.size[0] / 2) * CFG.cell, (gy + def.size[1] / 2) * CFG.cell);
  ctx.fillStyle = valid ? '#7ee3aa88' : '#f0646488';
  ctx.fillRect(point.x - def.size[0] * 16, point.y - def.size[1] * 16, def.size[0] * CFG.cell, def.size[1] * CFG.cell);
  ctx.strokeStyle = valid ? '#a6f1c4' : '#ff9696';
  ctx.lineWidth = 2;
  ctx.strokeRect(point.x - def.size[0] * 16, point.y - def.size[1] * 16, def.size[0] * CFG.cell, def.size[1] * CFG.cell);
}

function draw() {
  if (!state) return;
  const focus = role === 'hunter' ? state.hunter : state.builders[0];
  camera.x += (focus.x - camera.x) * 0.12;
  camera.y += (focus.y - camera.y) * 0.12;
  camera.x = Math.max(W / 2, Math.min(38 * CFG.cell - W / 2, camera.x));
  camera.y = Math.max(H / 2, Math.min(34 * CFG.cell - H / 2, camera.y));

  drawTerrain();
  for (const structure of state.structures) drawStructure(structure);
  for (const builder of state.builders) drawEntity(builder);
  drawEntity(state.hunter);
  drawPlacement();

  const prep = Math.max(0, Math.ceil(CFG.prep - state.time));
  if (prep > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '800 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Hunter released in ${prep}`, W / 2, 80);
  }
}

function updateHud() {
  const builder = state.builders[0];
  const hunter = state.hunter;
  const alive = state.builders.filter(item => item.alive).length;
  document.querySelector('#roleLabel').textContent = role === 'builder' ? 'BUILDER' : 'HUNTER';
  document.querySelector('#resources').textContent = role === 'builder'
    ? `M ${Math.floor(builder.m)} · C ${Math.floor(builder.c)}`
    : `Bounty ${Math.floor(hunter.bounty)} · HP ${Math.ceil(hunter.hp)}`;
  const left = Math.max(0, CFG.extraction - state.time);
  document.querySelector('#timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  document.querySelector('#remaining').textContent = `Builders ${alive}/5`;

  if (role === 'builder') updateBuildButtons();

  const atCenter = Math.hypot(hunter.x - 19 * CFG.cell, hunter.y - 16 * CFG.cell) < 68;
  shop.classList.toggle('hidden', role !== 'hunter' || !atCenter);
  if (role === 'hunter' && atCenter) shopUi();

  if (noticeTimer > 0) {
    noticeTimer -= CFG.tick;
    if (noticeTimer <= 0) clearNotice();
  }
}

function finish() {
  if (!state?.winner || !result.classList.contains('hidden')) return;
  result.classList.remove('hidden');
  hud.classList.add('hidden');
  tray.classList.add('hidden');
  shop.classList.add('hidden');
  joystick.classList.add('hidden');
  buildBtn.classList.add('hidden');
  abilityBtn.classList.add('hidden');
  clearNotice();
  document.querySelector('#resultEyebrow').textContent = state.winner === 'builders' ? 'HOLDFASTS SURVIVE' : 'THE HUNT IS COMPLETE';
  document.querySelector('#resultTitle').textContent = state.winner === 'builders' ? 'Builders Win' : 'Hunter Wins';
  document.querySelector('#resultBody').textContent = `${Math.floor(state.time / 60)}m ${Math.floor(state.time % 60)}s · ${state.stats.destroyed} structures destroyed · ${Math.floor(state.stats.earned)} bounty earned.`;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state && !paused && !state.winner) {
    acc += dt;
    while (acc >= CFG.tick) {
      step(state, commandsForTick(), CFG.tick);
      acc -= CFG.tick;
    }
    updateHud();
  }

  draw();
  finish();
  requestAnimationFrame(frame);
}

buildTray();
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
addEventListener('keydown', handleKeyDown, { passive: false });
addEventListener('keyup', handleKeyUp);
addEventListener('blur', resetInputs);
addEventListener('escapee:pause', resetInputs);
canvas.addEventListener('pointermove', pointerPosition);
canvas.addEventListener('pointerdown', handleCanvasPlacement);
canvas.addEventListener('contextmenu', event => {
  if (!placing) return;
  event.preventDefault();
  placing = false;
  tray.classList.add('hidden');
  setNotice('Placement cancelled.');
});
joystick.addEventListener('pointerdown', joystickDown);
joystick.addEventListener('pointermove', joystickMove);
joystick.addEventListener('pointerup', joystickRelease);
joystick.addEventListener('pointercancel', joystickRelease);

buildBtn.addEventListener('click', toggleBuildMenu);
abilityBtn.addEventListener('click', () => {
  if (state && role === 'hunter') state._dash = true;
});
document.querySelectorAll('[data-role]').forEach(button => {
  button.addEventListener('click', () => begin(button.dataset.role));
});
document.querySelector('#again').addEventListener('click', returnToRoleSelect);

window.EscapeeGame = {
  restart: () => begin(role || 'builder'),
  pause: () => { paused = true; resetInputs(); },
  resume: () => { paused = false; last = performance.now(); },
  setMuted() {},
  getStatus: () => state && !state.winner ? (paused ? 'paused' : 'playing') : 'game-over'
};

resize();
requestAnimationFrame(frame);
