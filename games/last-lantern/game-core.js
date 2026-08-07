'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const shell = document.getElementById('game-shell');

const els = {
  hud: document.getElementById('hud'),
  statusBars: document.getElementById('status-bars'),
  wave: document.getElementById('wave-readout'),
  score: document.getElementById('score-readout'),
  healthText: document.getElementById('health-text'),
  fuelText: document.getElementById('fuel-text'),
  healthFill: document.getElementById('health-fill'),
  fuelFill: document.getElementById('fuel-fill'),
  toast: document.getElementById('toast'),
  start: document.getElementById('start-screen'),
  upgrades: document.getElementById('upgrade-screen'),
  upgradeCards: document.getElementById('upgrade-cards'),
  gameOver: document.getElementById('game-over-screen'),
  gameOverCopy: document.getElementById('game-over-copy'),
  startButton: document.getElementById('start-button'),
  restartButton: document.getElementById('restart-button'),
  soundButton: document.getElementById('sound-button'),
  touchStick: document.getElementById('touch-stick'),
  touchKnob: document.getElementById('touch-knob')
};

let W = 960;
let H = 600;
let dpr = 1;
let state = 'start';
let lastTime = performance.now();
let toastTimer = 0;
let screenShake = 0;
let redFlash = 0;
let lanternPulse = 0;
let waveDelay = 0;
let wave = 0;
let score = 0;
let spawnQueue = [];
let spawnTimer = 0;
let pickupTimer = 0;
let upgradeChoices = [];
let scoreSubmitted = false;
let pausedFrom = 'playing';
let player;
let enemies = [];
let particles = [];
let pickups = [];
let motes = [];
const keys = new Set();
const joystick = { active: false, id: null, x: 0, y: 0 };

function readPreference(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

const audio = {
  enabled: readPreference('last-lantern-sound', 'on') !== 'off',
  ctx: null,
  master: null,
  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        this.master = null;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      try { this.ctx.resume()?.catch?.(() => {}); } catch {}
    }
    return this.ctx;
  },
  tone(freq, duration, type = 'sine', volume = 0.18, endFreq = null) {
    const ac = this.ensure();
    if (!ac || !this.master) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  },
  noise(duration = 0.06, volume = 0.08) {
    const ac = this.ensure();
    if (!ac || !this.master) return;
    const length = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  },
  toggle() {
    this.enabled = !this.enabled;
    writePreference('last-lantern-sound', this.enabled ? 'on' : 'off');
    updateSoundButton();
    if (this.enabled) this.tone(520, 0.07, 'sine', 0.12, 720);
  }
};

const enemyTypes = {
  shade: {
    name: 'Shade', radius: 12, speed: 47, hp: 34, damage: 12, reward: 18,
    color: '#766c67', eyeColor: '#d6a56d', shape: 'round', behavior: 'direct'
  },
  skitter: {
    name: 'Skitter', radius: 8, speed: 88, hp: 22, damage: 8, reward: 24,
    color: '#9a7660', eyeColor: '#d6a56d', shape: 'spike', behavior: 'direct'
  },
  brute: {
    name: 'Husk', radius: 20, speed: 30, hp: 112, damage: 24, reward: 54,
    color: '#665d58', eyeColor: '#d6a56d', shape: 'square', behavior: 'direct'
  },
  wisp: {
    name: 'Moth', radius: 10, speed: 59, hp: 44, damage: 13, reward: 36,
    color: '#a28a72', eyeColor: '#dfbd83', shape: 'diamond', behavior: 'orbit'
  },
  gloamwing: {
    name: 'Gloamwing', radius: 11, speed: 104, hp: 58, damage: 14, reward: 58,
    color: '#746b7d', eyeColor: '#cbb7dc', shape: 'wing', behavior: 'flutter'
  },
  thornkin: {
    name: 'Thornkin', radius: 15, speed: 67, hp: 116, damage: 19, reward: 78,
    color: '#6b705e', eyeColor: '#c5ce91', shape: 'thorn', behavior: 'lunge'
  },
  hollowHart: {
    name: 'Hollow Hart', radius: 26, speed: 42, hp: 235, damage: 31, reward: 118,
    color: '#514b54', eyeColor: '#d9c7e8', shape: 'antler', behavior: 'charge'
  },
  lanternEater: {
    name: 'Lantern Eater', radius: 23, speed: 50, hp: 310, damage: 22, fuelDamage: 18, reward: 152,
    color: '#423e45', eyeColor: '#e1c18d', shape: 'maw', behavior: 'direct'
  }
};

const upgrades = [
  {
    id: 'radius', name: 'Wider Wick', description: '+14% lantern radius.',
    current: () => `${Math.round(player.lightRadius)} px radius`,
    apply: () => { player.lightRadius *= 1.14; }
  },
  {
    id: 'damage', name: 'Hotter Flame', description: '+28% burn damage.',
    current: () => `${Math.round(player.burnDamage)} damage / sec`,
    apply: () => { player.burnDamage *= 1.28; }
  },
  {
    id: 'capacity', name: 'Deeper Reservoir', description: '+24 maximum fuel and refill 24.',
    current: () => `${Math.round(player.maxFuel)} max fuel`,
    apply: () => { player.maxFuel += 24; player.fuel = Math.min(player.maxFuel, player.fuel + 24); }
  },
  {
    id: 'speed', name: 'Quickened Step', description: '+14% movement speed.',
    current: () => `${Math.round(player.speed)} movement`,
    apply: () => { player.speed *= 1.14; }
  },
  {
    id: 'health', name: 'Steady Heart', description: '+20 maximum health and restore 30.',
    current: () => `${Math.round(player.maxHp)} max health`,
    apply: () => { player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 30); }
  },
  {
    id: 'efficiency', name: 'Clean Oil', description: 'Fuel drains 15% slower.',
    current: () => `${Math.round((1 - player.fuelEfficiency) * 100)}% fuel saved`,
    apply: () => { player.fuelEfficiency *= 0.85; }
  }
];

function updateSoundButton() {
  els.soundButton.dataset.muted = audio.enabled ? 'false' : 'true';
}

function resizeCanvas() {
  const rect = shell.getBoundingClientRect();
  const oldW = W;
  const oldH = H;
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (player && oldW > 0 && oldH > 0) {
    player.x = clamp(player.x / oldW * W, player.radius + 6, W - player.radius - 6);
    player.y = clamp(player.y / oldH * H, player.radius + 6, H - player.radius - 6);
    for (const enemy of enemies) {
      enemy.x = enemy.x / oldW * W;
      enemy.y = enemy.y / oldH * H;
    }
    for (const pickup of pickups) {
      pickup.x = pickup.x / oldW * W;
      pickup.y = pickup.y / oldH * H;
    }
  }
  seedMotes();
}

function seedMotes() {
  motes = Array.from({ length: Math.max(26, Math.floor(W * H / 22000)) }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: 0.5 + Math.random() * 1.4,
    alpha: 0.04 + Math.random() * 0.09,
    drift: 2 + Math.random() * 5
  }));
}

function resetGame() {
  player = {
    x: W / 2,
    y: H / 2,
    radius: 10,
    speed: Math.min(W, H) < 500 ? 182 : 205,
    hp: 100,
    maxHp: 100,
    fuel: 100,
    maxFuel: 100,
    fuelDrain: 3.35,
    fuelEfficiency: 1,
    lightRadius: Math.min(W, H) * 0.24,
    burnDamage: 32,
    invulnerable: 0,
    facing: -Math.PI / 2,
    moving: false
  };
  enemies = [];
  particles = [];
  pickups = [];
  wave = 0;
  score = 0;
  spawnQueue = [];
  spawnTimer = 0;
  pickupTimer = 2.8;
  waveDelay = 0;
  upgradeChoices = [];
  scoreSubmitted = false;
  pausedFrom = 'playing';
  screenShake = 0;
  redFlash = 0;
  lanternPulse = 0;
  keys.clear();
  resetJoystick();
  updateHud();
}

function startGame() {
  audio.ensure();
  resetGame();
  state = 'playing';
  els.start.classList.add('hidden');
  els.gameOver.classList.add('hidden');
  els.upgrades.classList.add('hidden');
  els.hud.classList.remove('hidden');
  els.statusBars.classList.remove('hidden');
  beginWave();
  audio.tone(180, 0.5, 'triangle', 0.13, 540);
  lastTime = performance.now();
}

function restartGame() {
  startGame();
}

function beginWave() {
  wave += 1;
  spawnQueue = buildWave(wave);
  spawnTimer = 0.3;
  waveDelay = 0;
  pickupTimer = Math.min(pickupTimer, 3.5);
  player.fuel = Math.min(player.maxFuel, player.fuel + Math.max(8, player.maxFuel * 0.1));
  showToast(`Wave ${wave}`);
  audio.tone(250, 0.11, 'triangle', 0.12, 360);
  updateHud();
}

function buildWave(n) {
  const queue = [];
  const count = 5 + Math.floor(n * 2.15);
  const pool = [
    ['shade', Math.max(12, 43 - n * 1.35)],
    ['skitter', n >= 2 ? 15 : 0],
    ['brute', n >= 4 ? 10 : 0],
    ['wisp', n >= 6 ? 9 : 0],
    ['gloamwing', n >= 8 ? Math.min(13, 5 + (n - 8) * 0.7) : 0],
    ['thornkin', n >= 11 ? Math.min(11, 4 + (n - 11) * 0.55) : 0],
    ['hollowHart', n >= 14 ? Math.min(7, 2.5 + (n - 14) * 0.32) : 0],
    ['lanternEater', n >= 18 ? Math.min(5.5, 1.8 + (n - 18) * 0.25) : 0]
  ].filter(([, weight]) => weight > 0);

  const totalWeight = pool.reduce((sum, [, weight]) => sum + weight, 0);
  for (let i = 0; i < count; i++) {
    let roll = Math.random() * totalWeight;
    let picked = 'shade';
    for (const [type, weight] of pool) {
      roll -= weight;
      if (roll <= 0) {
        picked = type;
        break;
      }
    }
    queue.push(picked);
  }

  const unlocks = { 8: 'gloamwing', 11: 'thornkin', 14: 'hollowHart', 18: 'lanternEater' };
  if (unlocks[n]) queue.push(unlocks[n]);
  if (n >= 14 && n % 4 === 0) queue.push('hollowHart');
  if (n >= 18 && n % 5 === 0) queue.push('lanternEater');

  return shuffle(queue);
}

function spawnEnemy(typeName) {
  const template = enemyTypes[typeName];
  const angle = Math.random() * Math.PI * 2;
  const edgeDistance = Math.hypot(W, H) * 0.56 + 34;
  const x = W / 2 + Math.cos(angle) * edgeDistance;
  const y = H / 2 + Math.sin(angle) * edgeDistance;
  const hpScale = 1 + Math.pow(Math.max(0, wave - 1), 1.08) * 0.105;
  const speedScale = 1 + Math.min(0.62, (wave - 1) * 0.022);
  enemies.push({
    type: typeName,
    x, y,
    radius: template.radius,
    speed: template.speed * speedScale,
    hp: template.hp * hpScale,
    maxHp: template.hp * hpScale,
    damage: template.damage * (1 + (wave - 1) * 0.035),
    reward: Math.round(template.reward * (1 + wave * 0.07)),
    color: template.color,
    eyeColor: template.eyeColor || '#d6a56d',
    shape: template.shape,
    behavior: template.behavior || 'direct',
    fuelDamage: template.fuelDamage || 0,
    hitGlow: 0,
    touchCooldown: 0,
    driftSeed: Math.random() * Math.PI * 2,
    orbitSign: Math.random() < 0.5 ? -1 : 1,
    burstClock: 0.8 + Math.random() * 2.4,
    burstTime: 0,
    flutterPhase: Math.random() * Math.PI * 2,
    dead: false
  });
}

function spawnFuelPickup(forceFar = true) {
  if (pickups.length >= 3 || !player) return;
  const margin = Math.min(58, Math.min(W, H) * 0.1);
  let x = W / 2;
  let y = H / 2;
  for (let tries = 0; tries < 28; tries++) {
    x = margin + Math.random() * Math.max(1, W - margin * 2);
    y = margin + Math.random() * Math.max(1, H - margin * 2);
    const distance = Math.hypot(x - player.x, y - player.y);
    if (!forceFar || distance > Math.min(player.lightRadius * 0.88, Math.min(W, H) * 0.3)) break;
  }
  pickups.push({ x, y, radius: 9, amount: 28 + Math.random() * 10, life: 19, pulse: Math.random() * Math.PI * 2, dead: false });
  audio.tone(620, 0.08, 'sine', 0.05, 760);
}
