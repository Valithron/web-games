import { createEscapeeInput } from '/shared/input.js';

const canvas = document.querySelector('#canvas');
const ctx = canvas?.getContext('2d', { alpha: false });
if (!canvas || !ctx) throw new Error('Aquila: canvas unavailable');

const ui = {
  wave: document.querySelector('#waveValue'),
  center: document.querySelector('#centerValue'),
  left: document.querySelector('#leftValue'),
  right: document.querySelector('#rightValue'),
  cohesion: document.querySelector('#cohesionValue'),
  score: document.querySelector('#scoreValue'),
  battleCall: document.querySelector('#battleCall'),
  startOverlay: document.querySelector('#startOverlay'),
  upgradeOverlay: document.querySelector('#upgradeOverlay'),
  endOverlay: document.querySelector('#endOverlay'),
  startButton: document.querySelector('#startButton'),
  restartButton: document.querySelector('#restartButton'),
  maneuverButton: document.querySelector('#maneuverButton'),
  maneuverLabel: document.querySelector('#maneuverLabel'),
  maneuverHint: document.querySelector('#maneuverHint'),
  waveComplete: document.querySelector('#waveComplete'),
  waveSummary: document.querySelector('#waveSummary'),
  upgradeGrid: document.querySelector('#upgradeGrid'),
  endSummary: document.querySelector('#endSummary'),
  finalScore: document.querySelector('#finalScore'),
  routed: document.querySelector('#routedValue'),
  encirclements: document.querySelector('#encirclementValue')
};

const input = createEscapeeInput({
  surface: canvas,
  joystick: document.querySelector('#joystick'),
  primary: ui.maneuverButton
});

const TAU = Math.PI * 2;
const ENEMY_TYPES = {
  infantry: { name: 'Warband', color: '#38434a', hp: 36, speed: 50, damage: 2.8, reward: 55, size: 15, unlock: 1 },
  raider: { name: 'Raiders', color: '#5a453d', hp: 24, speed: 74, damage: 2.3, reward: 60, size: 12, unlock: 2 },
  skirmisher: { name: 'Skirmishers', color: '#59614c', hp: 25, speed: 48, damage: 1.7, reward: 70, size: 12, unlock: 3, ranged: true },
  spears: { name: 'Spear Host', color: '#303d4c', hp: 52, speed: 42, damage: 3.6, reward: 90, size: 17, unlock: 5 },
  cavalry: { name: 'Cavalry', color: '#56412e', hp: 44, speed: 112, damage: 5.2, reward: 115, size: 17, unlock: 7, cavalry: true },
  heavy: { name: 'Heavy Host', color: '#252d33', hp: 88, speed: 34, damage: 5.1, reward: 150, size: 21, unlock: 9 }
};

const UPGRADES = [
  {
    key: 'recruits',
    title: 'Fresh Recruits',
    desc: 'Reinforce all three bodies and raise their maximum strength.',
    tag: 'MANPOWER',
    apply(s) {
      s.centerMax += 5; s.leftMax += 4; s.rightMax += 4;
      s.center = Math.min(s.centerMax, s.center + 9);
      s.left = Math.min(s.leftMax, s.left + 7);
      s.right = Math.min(s.rightMax, s.right + 7);
    }
  },
  {
    key: 'eagle-guard',
    title: 'Eagle Guard',
    desc: 'The center takes less damage and gains six maximum legionaries.',
    tag: 'AQUILA',
    apply(s) { s.centerMax += 6; s.center += 6; s.centerArmor *= .9; }
  },
  {
    key: 'hardened-wings',
    title: 'Hardened Wings',
    desc: 'Both wings gain strength and deal more damage while closing the trap.',
    tag: 'WINGS',
    apply(s) {
      s.leftMax += 4; s.rightMax += 4; s.left += 4; s.right += 4;
      s.closePower *= 1.14;
    }
  },
  {
    key: 'flexible-center',
    title: 'Flexible Center',
    desc: 'Yield farther and take less punishment while drawing the enemy inward.',
    tag: 'MANEUVER',
    apply(s) { s.yieldMax += 11; s.yieldArmor *= .88; }
  },
  {
    key: 'centurion',
    title: 'Centurion Drill',
    desc: 'Cohesion recovers faster and all formations fight more efficiently.',
    tag: 'DISCIPLINE',
    apply(s) { s.cohesionRecovery *= 1.18; s.attackPower *= 1.08; }
  },
  {
    key: 'pilum',
    title: 'Pilum Volley',
    desc: 'Each new wave opens with a stronger volley into the advancing host.',
    tag: 'VOLLEY',
    apply(s) { s.pilumLevel += 1; }
  },
  {
    key: 'reform',
    title: 'Rapid Reform',
    desc: 'The wings recover from an encirclement sooner and can maneuver again.',
    tag: 'TEMPO',
    apply(s) { s.reformDuration = Math.max(.75, s.reformDuration * .86); }
  },
  {
    key: 'cavalry-screen',
    title: 'Cavalry Screen',
    desc: 'Enemy cavalry deals much less damage when striking your wings.',
    tag: 'FLANKS',
    apply(s) { s.cavalryArmor *= .78; }
  }
];

let W = 1;
let H = 1;
let DPR = 1;
let lastFrame = performance.now();
let status = 'menu';
let paused = false;
let priorStatus = 'menu';
let state = null;
let enemies = [];
let particles = [];
let projectiles = [];
let previousPrimary = false;
let scoreSubmitted = false;
let callTimer = 0;
let audioContext = null;
let muted = false;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }
function choose(items) { return items[Math.floor(Math.random() * items.length)]; }

function freshState() {
  return {
    wave: 1,
    score: 0,
    routed: 0,
    encirclements: 0,
    center: 42,
    centerMax: 42,
    left: 28,
    leftMax: 28,
    right: 28,
    rightMax: 28,
    cohesion: 100,
    anchorX: W * .5,
    anchorY: H * .69,
    mode: 'hold',
    yieldDepth: 0,
    yieldHeld: 0,
    yieldMax: 78,
    closeTimer: 0,
    closeDuration: .92,
    reformTimer: 0,
    reformDuration: 1.55,
    closePower: 1,
    attackPower: 1,
    centerArmor: 1,
    yieldArmor: 1,
    cavalryArmor: 1,
    cohesionRecovery: 1,
    pilumLevel: 0,
    volleyPending: false,
    volleyTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    waveStarted: false,
    closeHits: new Set(),
    closeKillCount: 0,
    closeTrappedCount: 0,
    closeAwarded: false,
    ended: false
  };
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const oldW = W;
  const oldH = H;
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state && oldW > 1 && oldH > 1) {
    state.anchorX = clamp(state.anchorX / oldW * W, W * .18, W * .82);
    state.anchorY = clamp(state.anchorY / oldH * H, H * .42, H * .82);
  }
}

function scale() {
  return clamp(Math.min(W, H) / 620, .62, 1.08);
}

function formationPositions() {
  const s = scale();
  const closeProgress = state.mode === 'close'
    ? clamp(state.closeTimer / state.closeDuration, 0, 1)
    : 0;
  const open = 1 - Math.sin(closeProgress * Math.PI) * .50;
  const wingOffset = 112 * s * open;
  const wingDrop = Math.sin(closeProgress * Math.PI) * 30 * s;
  const depth = state.yieldDepth * s;
  return {
    left: { x: state.anchorX - wingOffset, y: state.anchorY - 8 * s + wingDrop },
    center: { x: state.anchorX, y: state.anchorY + depth },
    right: { x: state.anchorX + wingOffset, y: state.anchorY - 8 * s + wingDrop },
    eagle: { x: state.anchorX, y: state.anchorY + depth + 8 * s }
  };
}

function initAudio() {
  if (muted || audioContext) return audioContext;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  try {
    audioContext = new AudioCtor();
    audioContext.resume?.().catch?.(() => {});
  } catch { audioContext = null; }
  return audioContext;
}

function tone(frequency = 360, duration = .08, volume = .035, type = 'triangle', delay = 0) {
  if (muted) return;
  const audio = initAudio();
  if (!audio) return;
  try {
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  } catch {}
}

function cue(name) {
  if (name === 'start') { tone(196, .15, .04); tone(294, .18, .035, 'triangle', .10); tone(392, .22, .04, 'triangle', .21); }
  if (name === 'yield') tone(155, .09, .025, 'sawtooth');
  if (name === 'close') { tone(220, .1, .035); tone(330, .13, .035, 'square', .05); }
  if (name === 'trap') { tone(294, .11, .04); tone(440, .14, .045, 'triangle', .07); tone(587, .18, .04, 'triangle', .15); }
  if (name === 'wave') { tone(196, .1, .03); tone(247, .1, .03, 'triangle', .09); }
  if (name === 'hit') tone(105, .055, .018, 'square');
  if (name === 'upgrade') { tone(330, .09, .03); tone(494, .13, .035, 'triangle', .08); }
  if (name === 'gameover') { tone(146, .28, .05, 'sawtooth'); tone(98, .48, .04, 'triangle', .2); }
}

function battleCall(text, seconds = 1.5) {
  ui.battleCall.textContent = text;
  ui.battleCall.classList.add('show');
  callTimer = seconds;
}

function addParticles(x, y, color, count = 8, force = 100) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = reduced ? Math.ceil(count / 3) : count;
  for (let i = 0; i < total; i += 1) {
    const angle = Math.random() * TAU;
    const speed = Math.random() * force;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: .3 + Math.random() * .45,
      maxLife: .75,
      color,
      size: 2 + Math.random() * 3
    });
  }
}

function buildWave(number) {
  const queue = [];
  const total = 6 + number * 2 + Math.floor(number * .55);
  const available = Object.entries(ENEMY_TYPES).filter(([, def]) => number >= def.unlock);
  for (let i = 0; i < total; i += 1) {
    const roll = Math.random();
    let type = 'infantry';
    if (number >= 9 && roll < .10) type = 'heavy';
    else if (number >= 7 && roll < .23) type = 'cavalry';
    else if (number >= 5 && roll < .38) type = 'spears';
    else if (number >= 3 && roll < .55) type = 'skirmisher';
    else if (number >= 2 && roll < .72) type = 'raider';
    if (!available.some(([key]) => key === type)) type = choose(available)[0];
    queue.push(type);
  }
  if (number >= 7) queue.splice(Math.floor(queue.length * .45), 0, 'cavalry', 'cavalry');
  return queue;
}

function beginWave() {
  state.spawnQueue = buildWave(state.wave);
  state.spawnTimer = .45;
  state.waveStarted = true;
  state.mode = 'hold';
  state.yieldDepth = 0;
  state.closeTimer = 0;
  state.reformTimer = 0;
  state.closeHits.clear();
  state.closeKillCount = 0;
  state.closeTrappedCount = 0;
  battleCall(`Wave ${state.wave} · Hold the Eagle`, 1.7);
  cue('wave');
  state.volleyPending = state.pilumLevel > 0;
  state.volleyTimer = state.volleyPending ? .65 : 0;
}

function startGame() {
  initAudio();
  state = freshState();
  enemies = [];
  particles = [];
  projectiles = [];
  status = 'playing';
  paused = false;
  priorStatus = 'playing';
  scoreSubmitted = false;
  previousPrimary = false;
  input.reset?.();
  ui.startOverlay.hidden = true;
  ui.upgradeOverlay.hidden = true;
  ui.endOverlay.hidden = true;
  lastFrame = performance.now();
  cue('start');
  beginWave();
  updateHud();
}

function enemyScale() {
  return 1 + (state.wave - 1) * .105;
}

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  const s = scale();
  let x = rand(W * .16, W * .84);
  let y = -def.size * 2;
  let flank = null;
  if (def.cavalry) {
    flank = Math.random() < .5 ? 'left' : 'right';
    x = flank === 'left' ? -35 : W + 35;
    y = rand(H * .18, H * .45);
  } else if (Math.random() < Math.min(.22, state.wave * .015)) {
    x = Math.random() < .5 ? rand(W * .04, W * .22) : rand(W * .78, W * .96);
  }
  const mult = enemyScale();
  enemies.push({
    id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type,
    x, y,
    radius: def.size * s,
    hp: def.hp * mult,
    maxHp: def.hp * mult,
    speed: def.speed * (1 + Math.min(.45, (state.wave - 1) * .018)) * s,
    damage: def.damage * (1 + (state.wave - 1) * .06),
    reward: def.reward,
    flank,
    cooldown: rand(.15, .6),
    dead: false,
    trapped: false,
    trapTagged: false,
    hitFlash: 0,
    phase: Math.random() * TAU
  });
}

function segmentTarget(enemy, pos) {
  if (enemy.type === 'cavalry') return enemy.flank === 'left'
    ? { key: 'left', point: pos.left }
    : { key: 'right', point: pos.right };

  if (state.mode === 'yield' || state.yieldDepth > state.yieldMax * .3) {
    if (Math.random() < .985) return { key: 'center', point: pos.center };
  }

  const candidates = [
    { key: 'left', point: pos.left, strength: state.left },
    { key: 'center', point: pos.center, strength: state.center },
    { key: 'right', point: pos.right, strength: state.right }
  ].filter(item => item.strength > .1);
  candidates.sort((a, b) => Math.hypot(enemy.x - a.point.x, enemy.y - a.point.y) - Math.hypot(enemy.x - b.point.x, enemy.y - b.point.y));
  return candidates[0] || { key: 'center', point: pos.center };
}

function damageSegment(key, amount, enemy) {
  const lowCohesion = 1 + (100 - state.cohesion) * .006;
  let actual = amount * lowCohesion;
  if (key === 'center') {
    actual *= state.centerArmor;
    if (state.mode === 'yield') actual *= state.yieldArmor;
    state.center = Math.max(0, state.center - actual);
  } else if (key === 'left') {
    if (enemy?.type === 'cavalry') actual *= state.cavalryArmor;
    state.left = Math.max(0, state.left - actual);
  } else {
    if (enemy?.type === 'cavalry') actual *= state.cavalryArmor;
    state.right = Math.max(0, state.right - actual);
  }
  state.cohesion = Math.max(0, state.cohesion - actual * .65);
  if (actual > .4 && Math.random() < .18) cue('hit');
}

function killEnemy(enemy, encircled = false) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.routed += 1;
  const bonus = encircled ? 1.7 : 1;
  state.score += Math.round(enemy.reward * bonus + state.wave * 3);
  if (encircled) state.closeKillCount += 1;
  addParticles(enemy.x, enemy.y, ENEMY_TYPES[enemy.type].color, encircled ? 13 : 7, encircled ? 160 : 90);
}

function inTrap(enemy, pos) {
  if (state.mode !== 'close' || state.left <= 0 || state.right <= 0) return false;
  const minX = Math.min(pos.left.x, pos.right.x) - 20 * scale();
  const maxX = Math.max(pos.left.x, pos.right.x) + 20 * scale();
  const topY = Math.min(pos.left.y, pos.right.y) - 145 * scale();
  const bottomY = pos.center.y + 34 * scale();
  return enemy.x > minX && enemy.x < maxX && enemy.y > topY && enemy.y < bottomY;
}

function updateEnemies(dt) {
  const pos = formationPositions();
  const s = scale();
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.cooldown -= dt;

    const trapped = inTrap(enemy, pos);
    enemy.trapped = trapped;
    if (trapped) {
      if (!enemy.trapTagged) {
        enemy.trapTagged = true;
        state.closeTrappedCount += 1;
      }
      const wingRatio = (state.left / Math.max(1, state.leftMax) + state.right / Math.max(1, state.rightMax)) * .5;
      enemy.hp -= (34 + 24 * wingRatio) * state.closePower * state.attackPower * dt;
      enemy.hitFlash = .08;
      if (enemy.hp <= 0) { killEnemy(enemy, true); continue; }
    }

    const target = segmentTarget(enemy, pos);
    const dx = target.point.x - enemy.x;
    const dy = target.point.y - enemy.y;
    const dist = Math.max(.001, Math.hypot(dx, dy));

    if (ENEMY_TYPES[enemy.type].ranged && dist < 178 * s && dist > 92 * s) {
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 1.45 + Math.random() * .35;
        damageSegment(target.key, enemy.damage * .62, enemy);
        projectiles.push({ x: enemy.x, y: enemy.y, tx: target.point.x, ty: target.point.y, life: .24, enemy: true });
      }
      const sideStep = Math.sin(performance.now() * .0017 + enemy.phase) * 13;
      enemy.x += (-dy / dist) * sideStep * dt;
    } else if (dist <= enemy.radius + 24 * s) {
      if (enemy.cooldown <= 0) {
        enemy.cooldown = enemy.type === 'cavalry' ? .55 : .78;
        damageSegment(target.key, enemy.damage, enemy);
      }
      const strength = target.key === 'center' ? state.center : target.key === 'left' ? state.left : state.right;
      const max = target.key === 'center' ? state.centerMax : target.key === 'left' ? state.leftMax : state.rightMax;
      const ratio = clamp(strength / Math.max(1, max), .12, 1);
      let returnDamage = (7.5 + ratio * 7) * state.attackPower * dt;
      if (state.mode === 'yield' && target.key === 'center') returnDamage *= .62;
      if (enemy.type === 'heavy') returnDamage *= .72;
      enemy.hp -= returnDamage;
      if (enemy.hp <= 0) killEnemy(enemy, trapped);
    } else {
      let speed = enemy.speed;
      if (trapped) speed *= .27;
      if (enemy.type === 'cavalry' && dist < 180 * s) speed *= 1.25;
      enemy.x += dx / dist * speed * dt;
      enemy.y += dy / dist * speed * dt;
    }

    if (!enemy.dead && enemy.y > H + 55) {
      damageSegment('center', enemy.damage * 2.2, enemy);
      enemy.dead = true;
    }
  }
  enemies = enemies.filter(enemy => !enemy.dead);
}

function handleManeuver(dt) {
  const pressed = Boolean(input.primary);
  const canYield = state.mode === 'hold' || state.mode === 'yield';

  if (pressed && !previousPrimary && state.mode === 'hold') {
    state.mode = 'yield';
    state.yieldHeld = 0;
    cue('yield');
    battleCall('Yield the center…', 1.0);
  }

  if (state.mode === 'yield') {
    if (pressed) {
      state.yieldHeld += dt;
      state.yieldDepth = Math.min(state.yieldMax, state.yieldDepth + 56 * dt);
      state.cohesion = Math.max(0, state.cohesion - 2.1 * dt);
    } else if (previousPrimary && state.yieldHeld > .08) {
      state.mode = 'close';
      state.closeTimer = 0;
      state.closeHits.clear();
      state.closeKillCount = 0;
      state.closeTrappedCount = 0;
      state.closeAwarded = false;
      cue('close');
      battleCall('CLOSE THE WINGS!', 1.1);
    } else if (!pressed && state.yieldHeld <= .08) {
      state.mode = 'hold';
    }
  } else if (state.mode === 'close') {
    state.closeTimer += dt;
    if (state.closeTimer >= state.closeDuration) {
      const success = state.closeTrappedCount >= 3 || state.closeKillCount >= 3;
      if (success) {
        state.encirclements += 1;
        const bonus = 250 + state.closeTrappedCount * 55 + state.closeKillCount * 35 + state.wave * 20;
        state.score += bonus;
        state.cohesion = Math.min(100, state.cohesion + 22);
        cue('trap');
        battleCall(`Encirclement! +${bonus.toLocaleString()}`, 1.7);
      } else {
        battleCall('Trap closed too early', 1.1);
      }
      state.mode = 'reform';
      state.reformTimer = 0;
    }
  } else if (state.mode === 'reform') {
    state.reformTimer += dt;
    state.yieldDepth = Math.max(0, state.yieldDepth - state.yieldMax / state.reformDuration * dt);
    if (state.reformTimer >= state.reformDuration) {
      state.mode = 'hold';
      state.yieldDepth = 0;
    }
  } else if (!canYield) {
    state.yieldDepth = Math.max(0, state.yieldDepth - 30 * dt);
  }

  previousPrimary = pressed;
}

function updateMovement(dt) {
  const moveSpeed = 120 * scale();
  let ax = input.axisX;
  let ay = input.axisY;
  const length = Math.hypot(ax, ay);
  if (length > 1) { ax /= length; ay /= length; }
  const modeMult = state.mode === 'yield' ? .62 : state.mode === 'close' ? .42 : state.mode === 'reform' ? .72 : 1;
  state.anchorX += ax * moveSpeed * modeMult * dt;
  state.anchorY += ay * moveSpeed * modeMult * dt;
  const marginX = Math.max(82, 125 * scale());
  const top = Math.max(145, H * .27);
  const bottom = H - Math.max(94, 112 * scale());
  state.anchorX = clamp(state.anchorX, marginX, W - marginX);
  state.anchorY = clamp(state.anchorY, top, bottom);
}

function firePilumVolley() {
  const targets = enemies.slice(0, 2 + state.pilumLevel * 2);
  if (!targets.length) return false;
  for (const enemy of targets) {
    enemy.hp -= 9 + state.pilumLevel * 5;
    enemy.hitFlash = .12;
    projectiles.push({
      x: state.anchorX + rand(-100, 100) * scale(),
      y: state.anchorY - 20 * scale(),
      tx: enemy.x,
      ty: enemy.y,
      life: .18
    });
    if (enemy.hp <= 0) killEnemy(enemy, false);
  }
  enemies = enemies.filter(enemy => !enemy.dead);
  tone(520, .05, .025, 'square');
  battleCall('Pilum volley!', .9);
  return true;
}

function updateWave(dt) {
  if (state.volleyPending) {
    state.volleyTimer -= dt;
    if (state.volleyTimer <= 0 && firePilumVolley()) state.volleyPending = false;
  }
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy(state.spawnQueue.shift());
      state.spawnTimer = Math.max(.26, .82 - state.wave * .022) * rand(.72, 1.18);
    }
    return;
  }
  if (enemies.length === 0 && state.waveStarted && status === 'playing') completeWave();
}

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function completeWave() {
  status = 'between-rounds';
  priorStatus = status;
  input.reset?.();
  previousPrimary = false;
  state.waveStarted = false;
  state.score += 180 + state.wave * 45 + Math.round(state.center + state.left + state.right) * 2;
  state.cohesion = Math.min(100, state.cohesion + 16);
  state.center = Math.min(state.centerMax, state.center + 3);
  state.left = Math.min(state.leftMax, state.left + 2);
  state.right = Math.min(state.rightMax, state.right + 2);
  ui.waveComplete.textContent = `WAVE ${state.wave} BROKEN`;
  ui.waveSummary.textContent = `${state.routed} enemy squads routed. ${Math.ceil(state.center)} remain around the Aquila. Choose one reform before the next attack.`;
  ui.upgradeGrid.replaceChildren();
  const choices = shuffled(UPGRADES).slice(0, 3);
  for (const upgrade of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade';
    button.innerHTML = `<strong>${upgrade.title}</strong><span>${upgrade.desc}</span><em>${upgrade.tag}</em>`;
    button.addEventListener('click', () => {
      upgrade.apply(state);
      state.wave += 1;
      status = 'playing';
      priorStatus = 'playing';
      ui.upgradeOverlay.hidden = true;
      input.reset?.();
      previousPrimary = false;
      lastFrame = performance.now();
      cue('upgrade');
      beginWave();
    }, { once: true });
    ui.upgradeGrid.append(button);
  }
  ui.upgradeOverlay.hidden = false;
  ui.upgradeGrid.querySelector('button')?.focus();
  updateHud();
}

function finishGame() {
  if (!state || state.ended) return;
  state.ended = true;
  status = 'game-over';
  paused = false;
  input.reset?.();
  previousPrimary = false;
  enemies = [];
  cue('gameover');
  const final = Math.max(0, Math.floor(state.score));
  ui.finalScore.textContent = final.toLocaleString();
  ui.routed.textContent = state.routed.toLocaleString();
  ui.encirclements.textContent = state.encirclements.toLocaleString();
  ui.endSummary.textContent = `The legion reached wave ${state.wave}. ${Math.ceil(state.left)} held the left wing and ${Math.ceil(state.right)} held the right when the center finally broke.`;
  ui.endOverlay.hidden = false;
  if (!scoreSubmitted) {
    scoreSubmitted = true;
    window.EscapeeScores?.submit(final, {
      sortValue: final,
      label: 'Campaign score',
      display: `Wave ${state.wave} · ${state.routed} routed · ${state.encirclements} encirclements`
    });
  }
}

function update(dt) {
  if (!state || status !== 'playing' || paused) return;
  callTimer -= dt;
  if (callTimer <= 0) ui.battleCall.classList.remove('show');

  handleManeuver(dt);
  updateMovement(dt);
  updateWave(dt);
  updateEnemies(dt);

  if (state.mode === 'hold' || state.mode === 'reform') {
    const recovery = (state.mode === 'hold' ? 5.6 : 3.6) * state.cohesionRecovery * dt;
    state.cohesion = Math.min(100, state.cohesion + recovery);
  }

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= .96;
    particle.vy *= .96;
    particle.life -= dt;
  }
  particles = particles.filter(particle => particle.life > 0);
  for (const projectile of projectiles) projectile.life -= dt;
  projectiles = projectiles.filter(projectile => projectile.life > 0);

  if (state.center <= 0) finishGame();
  updateHud();
}

function updateHud() {
  if (!state) return;
  ui.wave.textContent = String(state.wave);
  ui.center.textContent = String(Math.max(0, Math.ceil(state.center)));
  ui.left.textContent = String(Math.max(0, Math.ceil(state.left)));
  ui.right.textContent = String(Math.max(0, Math.ceil(state.right)));
  ui.cohesion.textContent = `${Math.round(state.cohesion)}%`;
  ui.score.textContent = Math.floor(state.score).toLocaleString();

  ui.maneuverButton.classList.toggle('active', state.mode === 'yield');
  ui.maneuverButton.classList.toggle('cooldown', state.mode === 'close' || state.mode === 'reform');
  if (state.mode === 'yield') {
    ui.maneuverLabel.textContent = 'RELEASE';
    ui.maneuverHint.textContent = 'to close';
  } else if (state.mode === 'close') {
    ui.maneuverLabel.textContent = 'CLOSING';
    ui.maneuverHint.textContent = 'wings';
  } else if (state.mode === 'reform') {
    ui.maneuverLabel.textContent = 'REFORM';
    ui.maneuverHint.textContent = `${Math.max(0, state.reformDuration - state.reformTimer).toFixed(1)}s`;
  } else {
    ui.maneuverLabel.textContent = 'YIELD';
    ui.maneuverHint.textContent = 'hold';
  }
}

function drawGround() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#92784f');
  gradient.addColorStop(.62, '#765d3d');
  gradient.addColorStop(1, '#58422d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#d6bc806e';
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 137 + state.wave * 41) % (W + 80) - 40;
    const y = 70 + (i * 83) % Math.max(100, H - 100);
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + (i % 4) * 7, 5 + (i % 3), (i % 5) * .3, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = '#3b2b1e24';
  ctx.lineWidth = 2;
  const rows = 9;
  for (let i = 0; i < rows; i += 1) {
    const y = H * .15 + i * H * .095;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(W * .5, y + Math.sin(i * 2) * 12, W, y - 5);
    ctx.stroke();
  }
}

function drawEnemy(enemy) {
  const def = ENEMY_TYPES[enemy.type];
  const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  const count = Math.max(1, Math.ceil(6 * ratio));
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.type === 'cavalry') ctx.rotate(enemy.flank === 'left' ? .55 : -.55);
  const spacing = enemy.radius * .55;
  for (let i = 0; i < count; i += 1) {
    const col = i % 3 - 1;
    const row = Math.floor(i / 3);
    const x = col * spacing;
    const y = (row - .5) * spacing;
    ctx.fillStyle = enemy.hitFlash > 0 ? '#f5ead4' : def.color;
    if (enemy.type === 'cavalry') {
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * scale(), 4.5 * scale(), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d3c2a2';
      ctx.beginPath(); ctx.arc(x + 2 * scale(), y - 5 * scale(), 2.7 * scale(), 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y, 4.5 * scale(), 0, TAU); ctx.fill();
      if (enemy.type === 'spears' || enemy.type === 'heavy') {
        ctx.strokeStyle = '#d3c19b';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12 * scale()); ctx.stroke();
      }
    }
  }
  if (enemy.trapped) {
    ctx.strokeStyle = '#f0c95f';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 8 * scale(), 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawLegionBody(point, strength, maxStrength, kind) {
  const ratio = clamp(strength / Math.max(1, maxStrength), 0, 1);
  const maxDots = kind === 'center' ? 18 : 14;
  const count = Math.max(strength > 0 ? 1 : 0, Math.ceil(maxDots * ratio));
  const columns = kind === 'center' ? 6 : 7;
  const spacingX = 9 * scale();
  const spacingY = 10 * scale();
  ctx.save();
  ctx.translate(point.x, point.y);
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / columns);
    const col = i % columns - (Math.min(columns, count - row * columns) - 1) / 2;
    const x = col * spacingX;
    const y = row * spacingY;
    ctx.fillStyle = kind === 'center' ? '#a73830' : '#923028';
    ctx.fillRect(x - 3.5 * scale(), y - 3 * scale(), 7 * scale(), 7 * scale());
    ctx.fillStyle = '#d8c59b';
    ctx.fillRect(x - 3.5 * scale(), y - 5 * scale(), 7 * scale(), 2 * scale());
    ctx.strokeStyle = '#d0b77f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4 * scale(), y - 1 * scale());
    ctx.lineTo(x - 12 * scale(), y - 9 * scale());
    ctx.stroke();
  }
  ctx.restore();
}

function drawFormation() {
  const pos = formationPositions();
  const closeP = state.mode === 'close' ? clamp(state.closeTimer / state.closeDuration, 0, 1) : 0;

  if (state.mode === 'yield' || state.mode === 'close') {
    ctx.strokeStyle = state.mode === 'close' ? '#efd16b8a' : '#f6e1af35';
    ctx.lineWidth = state.mode === 'close' ? 4 : 2;
    ctx.setLineDash(state.mode === 'close' ? [] : [7, 7]);
    ctx.beginPath();
    ctx.moveTo(pos.left.x, pos.left.y);
    ctx.quadraticCurveTo(pos.center.x, pos.center.y + 18 * scale(), pos.right.x, pos.right.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.mode === 'close' && state.left > 0 && state.right > 0) {
    const alpha = .08 + Math.sin(closeP * Math.PI) * .12;
    ctx.fillStyle = `rgba(238,199,91,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(pos.left.x, pos.left.y - 140 * scale());
    ctx.lineTo(pos.right.x, pos.right.y - 140 * scale());
    ctx.lineTo(pos.center.x + 34 * scale(), pos.center.y + 26 * scale());
    ctx.lineTo(pos.center.x - 34 * scale(), pos.center.y + 26 * scale());
    ctx.closePath();
    ctx.fill();
  }

  drawLegionBody(pos.left, state.left, state.leftMax, 'left');
  drawLegionBody(pos.center, state.center, state.centerMax, 'center');
  drawLegionBody(pos.right, state.right, state.rightMax, 'right');

  ctx.save();
  ctx.translate(pos.eagle.x, pos.eagle.y);
  const pulse = 1 + Math.sin(performance.now() * .006) * .05;
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#f2cf62';
  ctx.lineWidth = 3 * scale();
  ctx.beginPath(); ctx.moveTo(0, -28 * scale()); ctx.lineTo(0, 12 * scale()); ctx.stroke();
  ctx.fillStyle = '#e0ad37';
  ctx.beginPath();
  ctx.moveTo(0, -30 * scale());
  ctx.lineTo(-12 * scale(), -19 * scale());
  ctx.lineTo(-4 * scale(), -18 * scale());
  ctx.lineTo(0, -10 * scale());
  ctx.lineTo(4 * scale(), -18 * scale());
  ctx.lineTo(12 * scale(), -19 * scale());
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawProjectiles() {
  for (const shot of projectiles) {
    const alpha = clamp(shot.life / .24, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = shot.enemy ? '#5f5040' : '#f1d280';
    ctx.lineWidth = shot.enemy ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(shot.x, shot.y);
    ctx.lineTo(shot.tx, shot.ty);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  if (!state) {
    ctx.fillStyle = '#6f5839';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  drawGround();
  for (const enemy of enemies) drawEnemy(enemy);
  drawProjectiles();
  drawFormation();
  drawParticles();
}

function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

ui.startButton.addEventListener('click', startGame);
ui.restartButton.addEventListener('click', startGame);

window.EscapeeGame = {
  restart: startGame,
  pause() {
    if (!state || status === 'menu' || status === 'game-over') return;
    priorStatus = status;
    paused = true;
    status = 'paused';
    input.reset?.();
    previousPrimary = false;
  },
  resume() {
    if (!state || status !== 'paused') return;
    paused = false;
    status = priorStatus === 'between-rounds' ? 'between-rounds' : 'playing';
    input.reset?.();
    previousPrimary = false;
    lastFrame = performance.now();
  },
  setMuted(value) {
    muted = Boolean(value);
    if (!muted) initAudio();
  },
  getStatus() {
    if (status === 'paused') return 'paused';
    return status;
  }
};

addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 80));
addEventListener('pagehide', () => { input.reset?.(); previousPrimary = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { input.reset?.(); previousPrimary = false; } });

resize();
state = freshState();
updateHud();
draw();
requestAnimationFrame(frame);
