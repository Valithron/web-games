import { createEscapeeInput } from '/shared/input.js';

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const joystick = document.querySelector('#joystick');
const joystickKnob = document.querySelector('.joystick-knob');
const input = createEscapeeInput({ surface: canvas, joystick });

const ui = {
  coverage: document.querySelector('#coverage'),
  health: document.querySelector('#health'),
  time: document.querySelector('#time'),
  pests: document.querySelector('#pests'),
  upgradeStrip: document.querySelector('#upgradeStrip'),
  startOverlay: document.querySelector('#startOverlay'),
  startButton: document.querySelector('#startButton'),
  upgradeOverlay: document.querySelector('#upgradeOverlay'),
  upgradeKicker: document.querySelector('#upgradeKicker'),
  upgradeOptions: document.querySelector('#upgradeOptions'),
  endOverlay: document.querySelector('#endOverlay'),
  resultText: document.querySelector('#resultText'),
  againButton: document.querySelector('#againButton'),
  soundBridge: document.querySelector('#soundBtn')
};

const TAU = Math.PI * 2;
const GAME_LENGTH = 150;
const UPGRADE_TIMES = [50, 100];
const CELL = 34;
const GRID_W = 30;
const GRID_H = 22;
const WORLD_W = GRID_W * CELL;
const WORLD_H = GRID_H * CELL;
const TOTAL_CELLS = GRID_W * GRID_H;

const COLORS = {
  soil: '#102018',
  soilLight: '#173021',
  leaf: '#5fae4d',
  leafBright: '#8fce61',
  leafDry: '#77764b',
  leafDead: '#514a34',
  water: '#78b9c5',
  cream: '#f5efcf',
  gold: '#d9c66d',
  aphid: '#b8d95e',
  caterpillar: '#73ad58',
  beetle: '#b65d37',
  ladybug: '#d75a48',
  mantis: '#9cc66d',
  marigold: '#e5b94c',
  thorn: '#cfd19e'
};

const UPGRADES = [
  { id: 'drip', name: 'Drip Irrigation', type: 'Garden system', short: 'Drip', description: 'Plants lose moisture 45% more slowly.' },
  { id: 'sprinklers', name: 'Sprinklers', type: 'Garden system', short: 'Sprinklers', description: 'Install three sprinklers that keep nearby beds watered.' },
  { id: 'compost', name: 'Rich Compost', type: 'Garden system', short: 'Compost', description: 'Moist plants regenerate health much faster.' },
  { id: 'reseed', name: 'Reseeding', type: 'Garden system', short: 'Reseeding', description: 'Destroyed beds can slowly regrow beside healthy plants.' },
  { id: 'ladybugs', name: 'Ladybugs', type: 'Natural defense', short: 'Ladybugs', description: 'Release three ladybugs that hunt nearby pests.' },
  { id: 'marigolds', name: 'Marigolds', type: 'Natural defense', short: 'Marigolds', description: 'Flowering beds slow pests moving through the garden.' },
  { id: 'thorns', name: 'Thorn Hedge', type: 'Natural defense', short: 'Thorns', description: 'Mature perimeter plants damage pests that chew them.' },
  { id: 'mantis', name: 'Predatory Mantis', type: 'Natural defense', short: 'Mantis', description: 'A mantis patrols the garden and strikes tough pests.' },
  { id: 'pressure', name: 'Pressure Nozzle', type: 'Gardener gear', short: 'Pressure', description: 'Increase automatic spray range by 28%.' },
  { id: 'twin', name: 'Twin Nozzle', type: 'Gardener gear', short: 'Twin Nozzle', description: 'Each spray cycle can fire at two different pests.' },
  { id: 'neem', name: 'Neem Spray', type: 'Gardener gear', short: 'Neem', description: 'Hits poison pests for additional damage over time.' },
  { id: 'boots', name: 'Garden Boots', type: 'Gardener gear', short: 'Boots', description: 'Move 22% faster through the beds.' }
];

let viewW = innerWidth;
let viewH = innerHeight;
let dpr = 1;
let last = performance.now();
let status = 'menu';
let paused = true;
let elapsed = 0;
let upgradeIndex = 0;
let scoreSubmitted = false;
let pestsStopped = 0;
let muted = false;
let audio = null;
let garden = [];
let bugs = [];
let shots = [];
let particles = [];
let allies = [];
let sprinklers = [];
let chosenUpgrades = new Set();
let currentUpgradeChoices = [];
let spawnClock = 0;
let growthClock = 0;
let shotClock = 0;
let sprinklerClock = 0;
let reseedClock = 0;
let hudClock = 0;
let camera = { x: WORLD_W / 2, y: WORLD_H / 2 };

const player = {
  x: WORLD_W / 2,
  y: WORLD_H / 2,
  r: 13,
  baseSpeed: 205,
  face: 0
};

function setStatus(next) {
  status = next;
  document.body.classList.remove('status-menu', 'status-playing', 'status-paused', 'status-between-rounds', 'status-game-over');
  document.body.classList.add(`status-${next}`);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  viewW = rect.width || innerWidth;
  viewH = rect.height || innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(viewW * dpr));
  canvas.height = Math.max(1, Math.round(viewH * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  last = performance.now();
}

function cellIndex(cx, cy) { return cy * GRID_W + cx; }
function inBounds(cx, cy) { return cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H; }
function getCell(cx, cy) { return inBounds(cx, cy) ? garden[cellIndex(cx, cy)] : null; }
function cellCenter(cell) { return { x: cell.cx * CELL + CELL / 2, y: cell.cy * CELL + CELL / 2 }; }
function worldToCell(x, y) { return { x: Math.floor(x / CELL), y: Math.floor(y / CELL) }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }

function ensureAudio() {
  if (muted || audio) return;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audio = new AudioCtor();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

function tone(freq, duration = .05, volume = .026, type = 'sine') {
  if (muted) return;
  ensureAudio();
  if (!audio) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {}
}

ui.soundBridge.addEventListener('click', () => {
  muted = !muted;
  if (!muted) ensureAudio();
});

function makeCell(cx, cy) {
  return { cx, cy, plant: 0, health: 0, moisture: 0, age: 0, marigold: false };
}

function resetGarden() {
  garden = [];
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) garden.push(makeCell(cx, cy));
  }

  const centerX = Math.floor(GRID_W / 2);
  const centerY = Math.floor(GRID_H / 2);
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      const cell = getCell(centerX + ox, centerY + oy);
      if (!cell || Math.abs(ox) + Math.abs(oy) > 3) continue;
      cell.plant = rand(.72, .96);
      cell.health = rand(88, 100);
      cell.moisture = rand(68, 92);
      cell.age = rand(5, 14);
    }
  }
}

function resetGame() {
  elapsed = 0;
  upgradeIndex = 0;
  scoreSubmitted = false;
  pestsStopped = 0;
  bugs = [];
  shots = [];
  particles = [];
  allies = [];
  sprinklers = [];
  chosenUpgrades = new Set();
  currentUpgradeChoices = [];
  spawnClock = 1.25;
  growthClock = .4;
  shotClock = .2;
  sprinklerClock = 1.2;
  reseedClock = 2.2;
  hudClock = 0;
  player.x = WORLD_W / 2;
  player.y = WORLD_H / 2;
  player.face = 0;
  resetGarden();
  ui.upgradeStrip.textContent = '';
  ui.upgradeOverlay.hidden = true;
  ui.endOverlay.hidden = true;
  updateHud(true);
  input.reset();
  last = performance.now();
}

function startGame() {
  ensureAudio();
  resetGame();
  ui.startOverlay.hidden = true;
  setStatus('playing');
  paused = false;
  tone(420, .08, .04, 'triangle');
}

function restartGame() {
  resetGame();
  ui.startOverlay.hidden = true;
  setStatus('playing');
  paused = false;
  tone(380, .06, .03, 'triangle');
}

function calculateStats() {
  let covered = 0;
  let healthSum = 0;
  let healthyWeight = 0;
  for (const cell of garden) {
    if (cell.plant > .24 && cell.health > 0) {
      covered++;
      healthSum += cell.health;
      healthyWeight += clamp(cell.plant, 0, 1) * clamp(cell.health / 100, 0, 1);
    }
  }
  const coverage = covered / TOTAL_CELLS * 100;
  const health = covered ? healthSum / covered : 0;
  const healthyCoverage = healthyWeight / TOTAL_CELLS * 100;
  return { coverage, health, healthyCoverage };
}

function updateHud(force = false) {
  if (!force && hudClock > 0) return;
  hudClock = .12;
  const stats = calculateStats();
  const remain = Math.max(0, Math.ceil(GAME_LENGTH - elapsed));
  ui.coverage.textContent = `${stats.coverage.toFixed(1)}%`;
  ui.health.textContent = `${Math.round(stats.health)}%`;
  ui.time.textContent = `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}`;
  ui.pests.textContent = String(pestsStopped);
}

function finishGame() {
  if (status === 'game-over' || scoreSubmitted) return;
  paused = true;
  setStatus('game-over');
  input.reset();
  const stats = calculateStats();
  const score = Math.max(0, Math.round(stats.healthyCoverage * 1000 + pestsStopped * 4));
  ui.resultText.innerHTML = `<span class="big">${stats.healthyCoverage.toFixed(1)}%</span>healthy garden coverage<br>${stats.coverage.toFixed(1)}% planted · ${stats.health.toFixed(0)}% average health · ${pestsStopped} pests stopped<br><strong>${score.toLocaleString()} points</strong>`;
  ui.endOverlay.hidden = false;
  scoreSubmitted = true;
  tone(523, .12, .045, 'triangle');
  setTimeout(() => tone(659, .16, .04, 'triangle'), 90);
  window.EscapeeScores?.submit(score, {
    label: 'Garden score',
    display: `${score.toLocaleString()} pts · ${stats.healthyCoverage.toFixed(1)}% healthy`
  });
}

function sourceCanSpread(cell) {
  return cell.plant > .6 && cell.health > 38 && cell.moisture > 48;
}

function attemptGrowth(attempts) {
  const sources = garden.filter(sourceCanSpread);
  if (!sources.length) return;
  const directions = [[1,0],[-1,0],[0,1],[0,-1]];
  let planted = 0;
  let tries = 0;
  while (planted < attempts && tries < attempts * 18) {
    tries++;
    const source = sources[Math.floor(Math.random() * sources.length)];
    const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
    const target = getCell(source.cx + dx, source.cy + dy);
    if (!target || (target.plant > .08 && target.health > 0)) continue;
    target.plant = rand(.13, .2);
    target.health = rand(62, 78);
    target.moisture = clamp(source.moisture * .62, 28, 58);
    target.age = 0;
    target.marigold = false;
    planted++;
    const point = cellCenter(target);
    burst(point.x, point.y, COLORS.leafBright, 4, 18);
  }
}

function updatePlants(dt) {
  const moistureDrain = chosenUpgrades.has('drip') ? 2.55 : 4.65;
  const regen = chosenUpgrades.has('compost') ? 4.2 : 1.9;
  for (const cell of garden) {
    if (cell.plant <= .01 || cell.health <= 0) continue;
    cell.age += dt;
    cell.moisture = Math.max(0, cell.moisture - moistureDrain * dt);
    if (cell.moisture > 34) {
      cell.plant = Math.min(1, cell.plant + (0.034 + cell.moisture * .00034) * dt);
      cell.health = Math.min(100, cell.health + regen * dt);
    } else if (cell.moisture < 12) {
      cell.health -= 1.15 * dt;
    }
    if (cell.health <= 0) {
      cell.health = 0;
      cell.plant = Math.max(.04, cell.plant * .45);
      cell.marigold = false;
    }
    if (chosenUpgrades.has('marigolds') && cell.plant > .82 && ((cell.cx * 17 + cell.cy * 31) % 13 === 0)) cell.marigold = true;
  }
}

function waterNearby(dt) {
  const radius = 92;
  const pc = worldToCell(player.x, player.y);
  for (let oy = -3; oy <= 3; oy++) {
    for (let ox = -3; ox <= 3; ox++) {
      const cell = getCell(pc.x + ox, pc.y + oy);
      if (!cell) continue;
      const center = cellCenter(cell);
      const d = Math.hypot(center.x - player.x, center.y - player.y);
      if (d > radius) continue;
      const strength = 1 - d / radius;
      cell.moisture = Math.min(100, cell.moisture + (32 + strength * 42) * dt);
      if (cell.plant > .05 && cell.health > 0) cell.health = Math.min(100, cell.health + strength * .8 * dt);
    }
  }
}

function installSprinklers() {
  const candidates = garden.filter(cell => cell.plant > .45 && cell.health > 0);
  sprinklers = [];
  for (let i = 0; i < 3 && candidates.length; i++) {
    const index = Math.floor(Math.random() * candidates.length);
    const cell = candidates.splice(index, 1)[0];
    const center = cellCenter(cell);
    sprinklers.push({ x: center.x, y: center.y, phase: Math.random() * TAU });
  }
}

function runSprinklers() {
  if (!chosenUpgrades.has('sprinklers')) return;
  for (const sprinkler of sprinklers) {
    const c = worldToCell(sprinkler.x, sprinkler.y);
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const cell = getCell(c.x + ox, c.y + oy);
        if (!cell || cell.health <= 0 || cell.plant <= .05) continue;
        const center = cellCenter(cell);
        if (Math.hypot(center.x - sprinkler.x, center.y - sprinkler.y) > 76) continue;
        cell.moisture = Math.min(100, cell.moisture + 24);
      }
    }
    burst(sprinkler.x, sprinkler.y, COLORS.water, 5, 34);
  }
}

function tryReseed() {
  if (!chosenUpgrades.has('reseed')) return;
  const candidates = [];
  for (const cell of garden) {
    if (cell.health > 0 && cell.plant > .1) continue;
    let healthyNeighbors = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const neighbor = getCell(cell.cx + dx, cell.cy + dy);
      if (neighbor && neighbor.health > 55 && neighbor.plant > .65) healthyNeighbors++;
    }
    if (healthyNeighbors >= 2) candidates.push(cell);
  }
  if (!candidates.length) return;
  const cell = candidates[Math.floor(Math.random() * candidates.length)];
  cell.plant = .15;
  cell.health = 55;
  cell.moisture = 38;
  cell.age = 0;
  cell.marigold = false;
  const center = cellCenter(cell);
  burst(center.x, center.y, COLORS.leafBright, 7, 26);
}

function isPerimeterPlant(cell) {
  if (!cell || cell.health <= 0 || cell.plant < .55) return false;
  return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
    const neighbor = getCell(cell.cx + dx, cell.cy + dy);
    return !neighbor || neighbor.health <= 0 || neighbor.plant < .22;
  });
}

function spawnBug() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = -20; y = Math.random() * WORLD_H; }
  else if (side === 1) { x = WORLD_W + 20; y = Math.random() * WORLD_H; }
  else if (side === 2) { x = Math.random() * WORLD_W; y = -20; }
  else { x = Math.random() * WORLD_W; y = WORLD_H + 20; }

  const progress = clamp(elapsed / GAME_LENGTH, 0, 1);
  const roll = Math.random();
  const beetleChance = .06 + progress * .16;
  const aphidChance = .31;
  let type;
  if (roll < beetleChance) type = 'beetle';
  else if (roll < beetleChance + aphidChance) type = 'aphid';
  else type = 'caterpillar';

  const data = type === 'beetle'
    ? { r: 11, hp: 4, speed: 34 + progress * 13, damage: 10.5 }
    : type === 'aphid'
      ? { r: 6, hp: 1, speed: 72 + progress * 20, damage: 4.5 }
      : { r: 8, hp: 2, speed: 50 + progress * 16, damage: 7 };

  bugs.push({ x, y, type, angle: 0, wobble: Math.random() * TAU, target: null, targetClock: 0, chewClock: .2, poison: 0, hitFlash: 0, ...data });
}

function findTargetPlant(bug) {
  const bc = worldToCell(bug.x, bug.y);
  let best = null;
  let bestD = Infinity;
  for (let radius = 0; radius <= 8; radius++) {
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        if (Math.abs(ox) !== radius && Math.abs(oy) !== radius) continue;
        const cell = getCell(bc.x + ox, bc.y + oy);
        if (!cell || cell.plant <= .2 || cell.health <= 0) continue;
        const center = cellCenter(cell);
        const d = (center.x - bug.x) ** 2 + (center.y - bug.y) ** 2;
        if (d < bestD) { bestD = d; best = cell; }
      }
    }
    if (best) break;
  }
  if (best) return best;

  const living = garden.filter(cell => cell.plant > .2 && cell.health > 0);
  if (!living.length) return null;
  for (let i = 0; i < Math.min(18, living.length); i++) {
    const cell = living[Math.floor(Math.random() * living.length)];
    const center = cellCenter(cell);
    const d = (center.x - bug.x) ** 2 + (center.y - bug.y) ** 2;
    if (d < bestD) { bestD = d; best = cell; }
  }
  return best;
}

function marigoldSlowAt(x, y) {
  if (!chosenUpgrades.has('marigolds')) return 1;
  const wc = worldToCell(x, y);
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      const cell = getCell(wc.x + ox, wc.y + oy);
      if (!cell?.marigold || cell.health <= 0) continue;
      const center = cellCenter(cell);
      if ((center.x - x) ** 2 + (center.y - y) ** 2 <= 82 ** 2) return .63;
    }
  }
  return 1;
}

function killBug(index, bug) {
  pestsStopped++;
  burst(bug.x, bug.y, bug.type === 'beetle' ? COLORS.beetle : COLORS.leafBright, bug.type === 'beetle' ? 9 : 6, 52);
  bugs.splice(index, 1);
  tone(bug.type === 'beetle' ? 150 : 220, .025, .012, 'square');
}

function updateBugs(dt) {
  for (let i = bugs.length - 1; i >= 0; i--) {
    const bug = bugs[i];
    bug.hitFlash = Math.max(0, bug.hitFlash - dt * 5);
    if (bug.poison > 0) {
      bug.poison = Math.max(0, bug.poison - dt);
      bug.hp -= .62 * dt;
    }
    if (bug.hp <= 0) { killBug(i, bug); continue; }

    bug.targetClock -= dt;
    if (bug.targetClock <= 0 || !bug.target || bug.target.health <= 0 || bug.target.plant <= .15) {
      bug.target = findTargetPlant(bug);
      bug.targetClock = rand(.45, .9);
    }
    if (!bug.target) {
      const dx = WORLD_W / 2 - bug.x;
      const dy = WORLD_H / 2 - bug.y;
      const len = Math.hypot(dx, dy) || 1;
      bug.x += dx / len * bug.speed * dt;
      bug.y += dy / len * bug.speed * dt;
      continue;
    }

    const targetPoint = cellCenter(bug.target);
    const dx = targetPoint.x - bug.x;
    const dy = targetPoint.y - bug.y;
    const dist = Math.hypot(dx, dy) || 1;
    bug.angle = Math.atan2(dy, dx);
    if (dist > bug.r + 8) {
      const slow = marigoldSlowAt(bug.x, bug.y);
      bug.x += dx / dist * bug.speed * slow * dt;
      bug.y += dy / dist * bug.speed * slow * dt;
    } else {
      bug.chewClock -= dt;
      if (bug.chewClock <= 0) {
        bug.chewClock = .42;
        bug.target.health = Math.max(0, bug.target.health - bug.damage * .42);
        bug.target.moisture = Math.max(0, bug.target.moisture - 2.2);
        burst(targetPoint.x, targetPoint.y, '#9f8f58', 3, 18);
      }
      if (chosenUpgrades.has('thorns') && isPerimeterPlant(bug.target)) bug.hp -= 1.05 * dt;
    }
  }
}

function nearestBugs(range, count = 1) {
  const maxD = range * range;
  return bugs
    .map(bug => ({ bug, d: (bug.x - player.x) ** 2 + (bug.y - player.y) ** 2 }))
    .filter(item => item.d <= maxD)
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(item => item.bug);
}

function fireAt(bug) {
  const dx = bug.x - player.x;
  const dy = bug.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  shots.push({ x: player.x, y: player.y, vx: dx / len * 430, vy: dy / len * 430, life: 1.15, damage: 1, poison: chosenUpgrades.has('neem') });
  player.face = Math.atan2(dy, dx);
}

function autoSpray(dt) {
  shotClock -= dt;
  if (shotClock > 0 || !bugs.length) return;
  const range = chosenUpgrades.has('pressure') ? 200 : 156;
  const targets = nearestBugs(range, chosenUpgrades.has('twin') ? 2 : 1);
  if (!targets.length) return;
  shotClock = .25;
  for (const target of targets) fireAt(target);
  tone(520, .025, .008, 'triangle');
}

function updateShots(dt) {
  for (let s = shots.length - 1; s >= 0; s--) {
    const shot = shots[s];
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    let removed = false;
    for (let b = bugs.length - 1; b >= 0; b--) {
      const bug = bugs[b];
      if ((shot.x - bug.x) ** 2 + (shot.y - bug.y) ** 2 > (bug.r + 4) ** 2) continue;
      bug.hp -= shot.damage;
      bug.hitFlash = 1;
      if (shot.poison) bug.poison = Math.max(bug.poison, 2);
      burst(shot.x, shot.y, COLORS.water, 3, 26);
      shots.splice(s, 1);
      removed = true;
      if (bug.hp <= 0) killBug(b, bug);
      break;
    }
    if (!removed && (shot.life <= 0 || shot.x < -40 || shot.y < -40 || shot.x > WORLD_W + 40 || shot.y > WORLD_H + 40)) shots.splice(s, 1);
  }
}

function spawnLadybugs() {
  for (let i = 0; i < 3; i++) allies.push({ type: 'ladybug', x: player.x + rand(-35,35), y: player.y + rand(-35,35), cooldown: rand(0,.5), phase: Math.random() * TAU });
}

function spawnMantis() {
  allies.push({ type: 'mantis', x: player.x + 28, y: player.y - 22, cooldown: .5, phase: Math.random() * TAU });
}

function updateAllies(dt) {
  for (const ally of allies) {
    ally.cooldown -= dt;
    ally.phase += dt * 2.2;
    if (ally.type === 'ladybug') {
      let target = null;
      let best = 260 ** 2;
      for (const bug of bugs) {
        const d = (bug.x - ally.x) ** 2 + (bug.y - ally.y) ** 2;
        if (d < best) { best = d; target = bug; }
      }
      if (target) {
        const dx = target.x - ally.x;
        const dy = target.y - ally.y;
        const len = Math.hypot(dx, dy) || 1;
        ally.x += dx / len * 105 * dt;
        ally.y += dy / len * 105 * dt;
        if (len < target.r + 10 && ally.cooldown <= 0) {
          target.hp -= 1;
          target.hitFlash = 1;
          ally.cooldown = .58;
          burst(target.x, target.y, COLORS.ladybug, 3, 24);
        }
      } else {
        const tx = player.x + Math.cos(ally.phase) * 58;
        const ty = player.y + Math.sin(ally.phase * .83) * 45;
        ally.x += (tx - ally.x) * Math.min(1, dt * 2.1);
        ally.y += (ty - ally.y) * Math.min(1, dt * 2.1);
      }
    } else {
      const tx = player.x + Math.cos(ally.phase * .4) * 70;
      const ty = player.y - 38 + Math.sin(ally.phase * .35) * 35;
      ally.x += (tx - ally.x) * Math.min(1, dt * 1.6);
      ally.y += (ty - ally.y) * Math.min(1, dt * 1.6);
      if (ally.cooldown <= 0 && bugs.length) {
        let target = null;
        let best = 340 ** 2;
        for (const bug of bugs) {
          const d = (bug.x - ally.x) ** 2 + (bug.y - ally.y) ** 2;
          if (d < best) { best = d; target = bug; }
        }
        if (target) {
          target.hp -= 2;
          target.hitFlash = 1;
          ally.cooldown = 1.18;
          particles.push({ x: ally.x, y: ally.y, vx: (target.x - ally.x) * 2.5, vy: (target.y - ally.y) * 2.5, life: .12, maxLife: .12, color: COLORS.mantis, line: true });
          tone(290, .035, .012, 'square');
        }
      }
    }
  }
}

function burst(x, y, color, count = 5, speed = 30) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const velocity = rand(speed * .35, speed);
    particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: rand(.24,.52), maxLife: .52, color, line: false });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(.1, dt);
    p.vy *= Math.pow(.1, dt);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function pickUpgradeChoices() {
  const pool = UPGRADES.filter(upgrade => !chosenUpgrades.has(upgrade.id));
  const choices = [];
  while (choices.length < 3 && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

function openUpgrade() {
  paused = true;
  setStatus('between-rounds');
  input.reset();
  currentUpgradeChoices = pickUpgradeChoices();
  ui.upgradeKicker.textContent = upgradeIndex === 0 ? 'Midseason improvement' : 'Late-season improvement';
  ui.upgradeOptions.textContent = '';
  currentUpgradeChoices.forEach((upgrade, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-option';
    button.innerHTML = `<span class="upgrade-number">${index + 1}</span><span class="upgrade-name">${upgrade.name}</span><span class="upgrade-type">${upgrade.type}</span><span class="upgrade-description">${upgrade.description}</span>`;
    button.addEventListener('click', () => chooseUpgrade(index));
    ui.upgradeOptions.appendChild(button);
  });
  ui.upgradeOverlay.hidden = false;
  ui.upgradeOptions.querySelector('button')?.focus();
  tone(620, .07, .025, 'triangle');
}

function applyUpgrade(upgrade) {
  chosenUpgrades.add(upgrade.id);
  if (upgrade.id === 'sprinklers') installSprinklers();
  if (upgrade.id === 'ladybugs') spawnLadybugs();
  if (upgrade.id === 'mantis') spawnMantis();
  if (upgrade.id === 'marigolds') {
    for (const cell of garden) {
      if (cell.plant > .82 && ((cell.cx * 17 + cell.cy * 31) % 13 === 0)) cell.marigold = true;
    }
  }
  const chip = document.createElement('span');
  chip.className = 'upgrade-chip';
  chip.textContent = upgrade.short;
  ui.upgradeStrip.appendChild(chip);
}

function chooseUpgrade(index) {
  if (status !== 'between-rounds') return;
  const upgrade = currentUpgradeChoices[index];
  if (!upgrade) return;
  applyUpgrade(upgrade);
  upgradeIndex++;
  ui.upgradeOverlay.hidden = true;
  setStatus('playing');
  paused = false;
  last = performance.now();
  tone(760, .08, .035, 'triangle');
}

function update(dt) {
  elapsed += dt;
  hudClock -= dt;
  sprinklerClock -= dt;
  reseedClock -= dt;
  growthClock -= dt;
  spawnClock -= dt;

  if (elapsed >= GAME_LENGTH) { finishGame(); return; }
  if (upgradeIndex < UPGRADE_TIMES.length && elapsed >= UPGRADE_TIMES[upgradeIndex]) { openUpgrade(); return; }

  const axisLength = Math.hypot(input.axisX, input.axisY) || 1;
  const moveX = input.axisX / Math.max(1, axisLength);
  const moveY = input.axisY / Math.max(1, axisLength);
  const speed = player.baseSpeed * (chosenUpgrades.has('boots') ? 1.22 : 1);
  player.x = clamp(player.x + moveX * speed * dt, player.r, WORLD_W - player.r);
  player.y = clamp(player.y + moveY * speed * dt, player.r, WORLD_H - player.r);
  if (Math.abs(moveX) + Math.abs(moveY) > .05) player.face = Math.atan2(moveY, moveX);

  updatePlants(dt);
  waterNearby(dt);

  if (growthClock <= 0) {
    growthClock = .58;
    attemptGrowth(elapsed > 92 ? 3 : 2);
  }

  if (sprinklerClock <= 0) {
    sprinklerClock = 1.45;
    runSprinklers();
  }

  if (reseedClock <= 0) {
    reseedClock = 2.2;
    tryReseed();
  }

  if (spawnClock <= 0) {
    const progress = clamp(elapsed / GAME_LENGTH, 0, 1);
    const interval = lerp(1.68, .74, Math.pow(progress, 1.22));
    spawnClock = interval * rand(.88, 1.12);
    spawnBug();
    if (elapsed > 126 && Math.random() < .18) spawnBug();
  }

  autoSpray(dt);
  updateShots(dt);
  updateBugs(dt);
  updateAllies(dt);
  updateParticles(dt);
  updateHud();
}

function cameraAxis(position, worldSize, viewSize) {
  if (viewSize >= worldSize) return worldSize / 2;
  return clamp(position, viewSize / 2, worldSize - viewSize / 2);
}

function updateCamera(dt) {
  const targetX = cameraAxis(player.x, WORLD_W, viewW);
  const targetY = cameraAxis(player.y, WORLD_H, viewH);
  const amount = 1 - Math.exp(-8 * dt);
  camera.x = lerp(camera.x, targetX, amount);
  camera.y = lerp(camera.y, targetY, amount);
}

function toScreen(x, y) {
  return { x: x - camera.x + viewW / 2, y: y - camera.y + viewH / 2 };
}

function drawBackground() {
  ctx.fillStyle = COLORS.soil;
  ctx.fillRect(0, 0, viewW, viewH);
  const worldTopLeft = toScreen(0, 0);
  ctx.fillStyle = COLORS.soilLight;
  ctx.fillRect(worldTopLeft.x, worldTopLeft.y, WORLD_W, WORLD_H);

  ctx.strokeStyle = 'rgba(220,210,150,.045)';
  ctx.lineWidth = 1;
  for (let cx = 0; cx <= GRID_W; cx++) {
    const p = toScreen(cx * CELL, 0);
    ctx.beginPath();
    ctx.moveTo(p.x, worldTopLeft.y);
    ctx.lineTo(p.x, worldTopLeft.y + WORLD_H);
    ctx.stroke();
  }
  for (let cy = 0; cy <= GRID_H; cy++) {
    const p = toScreen(0, cy * CELL);
    ctx.beginPath();
    ctx.moveTo(worldTopLeft.x, p.y);
    ctx.lineTo(worldTopLeft.x + WORLD_W, p.y);
    ctx.stroke();
  }
}

function drawPlants() {
  for (const cell of garden) {
    if (cell.plant <= .03) continue;
    const center = toScreen(cell.cx * CELL + CELL / 2, cell.cy * CELL + CELL / 2);
    if (center.x < -CELL || center.y < -CELL || center.x > viewW + CELL || center.y > viewH + CELL) continue;
    const alive = cell.health > 0;
    const healthT = clamp(cell.health / 100, 0, 1);
    const size = 4 + cell.plant * 10;
    const dry = cell.moisture < 18;
    ctx.globalAlpha = .45 + healthT * .55;
    ctx.fillStyle = alive ? (dry ? COLORS.leafDry : COLORS.leaf) : COLORS.leafDead;
    for (let i = 0; i < 3; i++) {
      const angle = i * TAU / 3 + (cell.cx * .4 + cell.cy * .27);
      ctx.beginPath();
      ctx.ellipse(center.x + Math.cos(angle) * size * .28, center.y + Math.sin(angle) * size * .28, size * .65, size * .28, angle, 0, TAU);
      ctx.fill();
    }
    if (cell.plant > .78 && alive) {
      ctx.globalAlpha = .9;
      ctx.fillStyle = cell.marigold ? COLORS.marigold : COLORS.leafBright;
      ctx.beginPath();
      ctx.arc(center.x, center.y, cell.marigold ? 4.5 : 2.3, 0, TAU);
      ctx.fill();
    }
    if (chosenUpgrades.has('thorns') && isPerimeterPlant(cell)) {
      ctx.strokeStyle = COLORS.thorn;
      ctx.globalAlpha = .45;
      ctx.beginPath();
      ctx.moveTo(center.x - size * .7, center.y + size * .7);
      ctx.lineTo(center.x - size * .35, center.y + size * .2);
      ctx.lineTo(center.x, center.y + size * .75);
      ctx.stroke();
    }
    if (chosenUpgrades.has('drip') && alive && cell.plant > .35) {
      ctx.fillStyle = COLORS.water;
      ctx.globalAlpha = .34;
      ctx.beginPath();
      ctx.arc(center.x + 8, center.y + 8, 1.5, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawSprinklers(now) {
  for (const sprinkler of sprinklers) {
    const p = toScreen(sprinkler.x, sprinkler.y);
    ctx.strokeStyle = COLORS.water;
    ctx.lineWidth = 2;
    ctx.globalAlpha = .8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, TAU);
    ctx.stroke();
    const angle = now * .004 + sprinkler.phase;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(angle) * 12, p.y + Math.sin(angle) * 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBugs() {
  for (const bug of bugs) {
    const p = toScreen(bug.x, bug.y);
    const color = bug.hitFlash > 0 ? COLORS.cream : bug.type === 'beetle' ? COLORS.beetle : bug.type === 'aphid' ? COLORS.aphid : COLORS.caterpillar;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(bug.angle);
    ctx.fillStyle = color;
    if (bug.type === 'beetle') {
      ctx.beginPath(); ctx.ellipse(0, 0, bug.r, bug.r * .78, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4b2a20'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -bug.r * .65); ctx.lineTo(0, bug.r * .65); ctx.stroke();
    } else if (bug.type === 'aphid') {
      ctx.beginPath(); ctx.arc(0, 0, bug.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b853d'; ctx.beginPath(); ctx.arc(bug.r * .6, 0, bug.r * .45, 0, TAU); ctx.fill();
    } else {
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 5, Math.sin(i + bug.wobble) * 1.5, bug.r * .68, 0, TAU); ctx.fill(); }
    }
    if (bug.poison > 0) {
      ctx.strokeStyle = '#b0d57a'; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(0, 0, bug.r + 4, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawShots() {
  ctx.fillStyle = COLORS.water;
  for (const shot of shots) {
    const p = toScreen(shot.x, shot.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, TAU);
    ctx.fill();
  }
}

function drawAllies() {
  for (const ally of allies) {
    const p = toScreen(ally.x, ally.y);
    if (ally.type === 'ladybug') {
      ctx.fillStyle = COLORS.ladybug;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3f241f';
      ctx.beginPath(); ctx.arc(p.x + 2, p.y - 1, 1.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - 2, p.y + 2, 1.2, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = COLORS.mantis;
      ctx.beginPath();
      ctx.moveTo(p.x + 9, p.y);
      ctx.lineTo(p.x - 6, p.y - 6);
      ctx.lineTo(p.x - 4, p.y + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPlayer(now) {
  const p = toScreen(player.x, player.y);
  const bob = Math.sin(now * .006) * .8;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(player.face);
  ctx.fillStyle = '#4f7244';
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, TAU); ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath(); ctx.arc(3, -2, player.r * .55, 0, TAU); ctx.fill();
  ctx.strokeStyle = COLORS.water;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(18, 2); ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const s = toScreen(p.x, p.y);
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.strokeStyle = p.color;
    ctx.fillStyle = p.color;
    if (p.line) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + p.vx * .06, s.y + p.vy * .06);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.1, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function updateJoystickVisual() {
  if (!joystickKnob) return;
  const x = clamp(input.axisX, -1, 1) * 18;
  const y = clamp(input.axisY, -1, 1) * 18;
  joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function render(now, dt) {
  updateCamera(dt);
  updateJoystickVisual();
  drawBackground();
  drawPlants();
  drawSprinklers(now);
  drawShots();
  drawBugs();
  drawAllies();
  drawPlayer(now);
  drawParticles();

  if (status === 'menu') {
    const center = toScreen(WORLD_W / 2, WORLD_H / 2);
    ctx.strokeStyle = 'rgba(217,198,109,.2)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(center.x, center.y, 116, 0, TAU); ctx.stroke();
  }
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, .05);
  last = now;
  if (!paused && status === 'playing') update(dt);
  else if (status !== 'menu') updateParticles(dt);
  render(now, dt);
  requestAnimationFrame(frame);
}

ui.startButton.addEventListener('click', startGame);
ui.againButton.addEventListener('click', restartGame);

addEventListener('keydown', event => {
  if (status === 'between-rounds' && ['Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].includes(event.code)) {
    event.preventDefault();
    const value = Number(event.code.replace('Digit','').replace('Numpad','')) - 1;
    chooseUpgrade(value);
  }
});

window.EscapeeGame = {
  pause() {
    paused = true;
    if (status === 'playing') setStatus('paused');
    input.reset();
  },
  resume() {
    if (status === 'paused') {
      setStatus('playing');
      paused = false;
    } else if (status === 'between-rounds' || status === 'game-over' || status === 'menu') {
      paused = true;
    }
    last = performance.now();
  },
  restart: restartGame,
  setMuted(value) {
    muted = Boolean(value);
    if (!muted) {
      try { ensureAudio(); } catch {}
    }
  },
  getStatus: () => status
};

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 80));
window.visualViewport?.addEventListener('resize', resize);

resetGarden();
updateHud(true);
resize();
requestAnimationFrame(frame);
