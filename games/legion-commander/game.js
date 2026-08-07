import { createEscapeeInput } from '/shared/input.js';

const canvas = document.querySelector('#canvas');
const ctx = canvas?.getContext('2d', { alpha: false });
if (!canvas || !ctx) throw new Error('Legion Commander: canvas unavailable');

const ui = {
  wave: document.querySelector('#waveValue'),
  legion: document.querySelector('#legionValue'),
  eagle: document.querySelector('#eagleValue'),
  denarii: document.querySelector('#denariiValue'),
  kills: document.querySelector('#killsValue'),
  score: document.querySelector('#scoreValue'),
  battleCall: document.querySelector('#battleCall'),
  startOverlay: document.querySelector('#startOverlay'),
  shopOverlay: document.querySelector('#shopOverlay'),
  endOverlay: document.querySelector('#endOverlay'),
  startButton: document.querySelector('#startButton'),
  restartButton: document.querySelector('#restartButton'),
  nextWaveButton: document.querySelector('#nextWaveButton'),
  waveComplete: document.querySelector('#waveComplete'),
  shopSummary: document.querySelector('#shopSummary'),
  shopGrid: document.querySelector('#shopGrid'),
  endSummary: document.querySelector('#endSummary'),
  finalScore: document.querySelector('#finalScore'),
  peak: document.querySelector('#peakValue'),
  finalKills: document.querySelector('#finalKills')
};

const input = createEscapeeInput({
  surface: canvas,
  joystick: document.querySelector('#joystick')
});

const TAU = Math.PI * 2;
const ENEMIES = {
  warrior: { name: 'Warrior', hp: 20, speed: 54, damage: 8, rate: .9, radius: 7, reward: 1, color: '#29352b' },
  raider: { name: 'Raider', hp: 14, speed: 86, damage: 6, rate: .72, radius: 6, reward: 1, color: '#45503c' },
  spearman: { name: 'Spearman', hp: 34, speed: 46, damage: 11, rate: 1.05, radius: 8, reward: 2, color: '#35413a' },
  skirmisher: { name: 'Skirmisher', hp: 22, speed: 59, damage: 5, rate: 1.25, radius: 7, reward: 2, color: '#65513c', ranged: true },
  horseman: { name: 'Horseman', hp: 48, speed: 102, damage: 15, rate: .95, radius: 10, reward: 3, color: '#40372e' },
  champion: { name: 'Champion', hp: 100, speed: 38, damage: 22, rate: 1.15, radius: 13, reward: 6, color: '#202a25' }
};

const UPGRADE_DEFS = [
  {
    key: 'recruits', title: 'Fresh Cohort', desc: 'Add 6 legionaries immediately.', base: 8, growth: 5, repeatable: true,
    apply(s) { addLegionaries(6 + Math.floor(s.levels.recruitment / 2), s.eagle.x, s.eagle.y); }
  },
  {
    key: 'swords', title: 'Gladius Drill', desc: 'Legionary melee damage +18%.', base: 12, growth: 9,
    apply(s) { s.levels.swords += 1; s.soldierDamage *= 1.18; }
  },
  {
    key: 'armor', title: 'Lorica Issue', desc: 'Legionary maximum health +22% and heal the formation.', base: 14, growth: 10,
    apply(s) {
      s.levels.armor += 1;
      s.soldierMaxHp *= 1.22;
      for (const soldier of soldiers) { soldier.maxHp = s.soldierMaxHp; soldier.hp = soldier.maxHp; }
    }
  },
  {
    key: 'centurion', title: 'Centurion Cadence', desc: 'Legionaries attack 15% faster.', base: 15, growth: 11,
    apply(s) { s.levels.centurion += 1; s.attackRate *= .85; }
  },
  {
    key: 'pila', title: 'Pilum Volley', desc: 'Periodic pila strike more enemies before contact.', base: 16, growth: 12,
    apply(s) { s.levels.pila += 1; }
  },
  {
    key: 'eagle', title: 'Eagle Guard', desc: '+30 Aquila health, restore it, and reduce direct damage.', base: 18, growth: 13,
    apply(s) {
      s.levels.eagle += 1;
      s.eagleMaxHp += 30;
      s.eagleHp = Math.min(s.eagleMaxHp, s.eagleHp + 45);
      s.eagleArmor = Math.min(.55, s.eagleArmor + .08);
    }
  },
  {
    key: 'recruitment', title: 'Provincial Levy', desc: 'Every reinforcement cohort arrives with 2 more men.', base: 13, growth: 10,
    apply(s) { s.levels.recruitment += 1; }
  },
  {
    key: 'auxilia', title: 'Auxilia Archers', desc: 'Add an automatic arrow volley; upgrades increase its size.', base: 17, growth: 12,
    apply(s) { s.levels.auxilia += 1; }
  },
  {
    key: 'march', title: 'Forced March', desc: 'The Aquila and formation move 8% faster.', base: 11, growth: 9,
    apply(s) { s.levels.march += 1; s.moveSpeed *= 1.08; }
  }
];

let W = 1;
let H = 1;
let DPR = 1;
let state = null;
let status = 'menu';
let priorStatus = 'menu';
let paused = false;
let lastFrame = performance.now();
let soldiers = [];
let enemies = [];
let reinforcements = [];
let particles = [];
let projectiles = [];
let callTimer = 0;
let scoreSubmitted = false;
let muted = false;
let audio = null;
let nextEntityId = 1;

function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function initAudio() {
  if (muted || audio) return audio;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  try {
    audio = new AudioCtor();
    audio.resume?.().catch?.(() => {});
  } catch { audio = null; }
  return audio;
}

function tone(from, to = from, duration = .07, volume = .035, type = 'triangle') {
  if (muted) return;
  const ac = audio;
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, from), ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), ac.currentTime + duration);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration + .01);
  } catch {}
}

function cue(type) {
  if (type === 'kill') tone(260, 180, .045, .018, 'square');
  else if (type === 'join') { tone(330, 440, .09, .035); tone(440, 660, .11, .03); }
  else if (type === 'wave') { tone(146, 196, .13, .038, 'sawtooth'); tone(220, 294, .13, .028); }
  else if (type === 'buy') { tone(392, 523, .09, .03); tone(523, 659, .1, .025); }
  else if (type === 'eagle') tone(110, 58, .16, .055, 'sawtooth');
  else if (type === 'gameover') { tone(196, 82, .45, .045, 'sawtooth'); tone(130, 55, .55, .04); }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state) {
    state.eagle.x = clamp(state.eagle.x, 42, W - 42);
    state.eagle.y = clamp(state.eagle.y, 88, H - 42);
  }
}

function freshState() {
  return {
    wave: 1,
    score: 0,
    kills: 0,
    denarii: 0,
    peakLegion: 12,
    eagle: { x: W / 2, y: H * .58 },
    eagleHp: 100,
    eagleMaxHp: 100,
    eagleArmor: 0,
    soldierMaxHp: 30,
    soldierDamage: 9,
    attackRate: .62,
    moveSpeed: 190,
    spawnRemaining: 0,
    spawnTimer: 0,
    waveElapsed: 0,
    reinforcementTimes: [],
    reinforcementIndex: 0,
    pilaTimer: 2.1,
    auxiliaTimer: 2.5,
    ended: false,
    levels: { recruits: 0, swords: 0, armor: 0, centurion: 0, pila: 0, eagle: 0, recruitment: 0, auxilia: 0, march: 0 },
    purchases: { recruits: 0, swords: 0, armor: 0, centurion: 0, pila: 0, eagle: 0, recruitment: 0, auxilia: 0, march: 0 }
  };
}

function startGame() {
  state = freshState();
  soldiers = [];
  enemies = [];
  reinforcements = [];
  particles = [];
  projectiles = [];
  scoreSubmitted = false;
  paused = false;
  status = 'playing';
  priorStatus = 'playing';
  ui.startOverlay.hidden = true;
  ui.shopOverlay.hidden = true;
  ui.endOverlay.hidden = true;
  input.reset?.();
  for (let i = 0; i < 12; i += 1) addSoldier(state.eagle.x + rand(-25, 25), state.eagle.y + rand(-25, 25));
  state.peakLegion = soldiers.length;
  lastFrame = performance.now();
  call('Keep the Eagle moving. The legion will form around it.', 2.6);
  beginWave();
}

function addSoldier(x, y) {
  soldiers.push({
    id: nextEntityId++, x, y, vx: 0, vy: 0,
    hp: state.soldierMaxHp, maxHp: state.soldierMaxHp,
    attack: rand(0, state.attackRate), flash: 0,
    walkPhase: rand(0, TAU),
    strideRate: rand(6.2, 8.4),
    swayAmount: rand(.45, 1.15)
  });
}

function addLegionaries(count, x, y) {
  for (let i = 0; i < count; i += 1) addSoldier(x + rand(-20, 20), y + rand(-20, 20));
  state.peakLegion = Math.max(state.peakLegion, soldiers.length);
}

function call(text, seconds = 1.6) {
  ui.battleCall.textContent = text;
  ui.battleCall.classList.add('show');
  callTimer = seconds;
}

function enemyTypeForWave(wave) {
  const pool = ['warrior', 'warrior', 'warrior', 'raider'];
  if (wave >= 3) pool.push('spearman');
  if (wave >= 5) pool.push('skirmisher');
  if (wave >= 7) pool.push('horseman');
  if (wave >= 10) pool.push('champion');
  if (wave >= 12) pool.push('horseman', 'spearman', 'champion');
  return pool[Math.floor(Math.random() * pool.length)];
}

function edgeSpawn(margin = 26) {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: rand(margin, W - margin), y: -margin };
  if (edge === 1) return { x: W + margin, y: rand(margin, H - margin) };
  if (edge === 2) return { x: rand(margin, W - margin), y: H + margin };
  return { x: -margin, y: rand(margin, H - margin) };
}

function spawnEnemy() {
  const type = enemyTypeForWave(state.wave);
  const def = ENEMIES[type];
  const pos = edgeSpawn(34);
  const healthScale = 1 + Math.max(0, state.wave - 1) * .055;
  const damageScale = 1 + Math.max(0, state.wave - 1) * .028;
  enemies.push({
    id: nextEntityId++, type, x: pos.x, y: pos.y,
    hp: def.hp * healthScale, maxHp: def.hp * healthScale,
    speed: def.speed * (1 + Math.min(.35, state.wave * .008)),
    damage: def.damage * damageScale,
    attack: rand(0, def.rate), rangedAttack: rand(.5, 1.4),
    dead: false, flash: 0
  });
}

function spawnReinforcement() {
  const pos = edgeSpawn(38);
  const count = 4 + state.levels.recruitment * 2 + Math.floor(state.wave / 6) + Math.floor(Math.random() * 3);
  reinforcements.push({
    id: nextEntityId++, x: pos.x, y: pos.y, count,
    hp: count * state.soldierMaxHp * .82,
    maxHp: count * state.soldierMaxHp * .82,
    speed: 82 + state.levels.march * 4,
    attack: 0, flash: 0, dead: false
  });
  call(`Reinforcements: ${count} men marching to the Aquila`, 2.1);
}

function beginWave() {
  state.waveElapsed = 0;
  state.spawnRemaining = 10 + state.wave * 5 + Math.floor(Math.pow(state.wave, 1.18));
  state.spawnTimer = .4;
  const squads = Math.min(4, 1 + Math.floor((state.wave - 1) / 4));
  state.reinforcementTimes = Array.from({ length: squads }, (_, i) => 3.5 + i * (9 + rand(-1.5, 2.5)));
  state.reinforcementIndex = 0;
  state.pilaTimer = .8;
  state.auxiliaTimer = 1.6;
  cue('wave');
  call(`Wave ${state.wave} · ${state.spawnRemaining} enemy fighters`, 1.8);
  updateHud();
}

function formationSlot(index, total) {
  if (index === 0) return { x: 0, y: 24 };
  const columns = clamp(Math.ceil(Math.sqrt(Math.max(1, total) * 1.35)), 4, 11);
  const row = Math.floor(index / columns);
  const rowStart = row * columns;
  const rowCount = Math.min(columns, total - rowStart);
  const col = index - rowStart;
  const rank = row % 2 === 0 ? -(Math.floor(row / 2) + 1) : Math.floor(row / 2) + 1;
  const spacingX = total > 80 ? 15 : 17;
  const spacingY = total > 80 ? 14 : 16;
  return {
    x: (col - (rowCount - 1) / 2) * spacingX + (Math.abs(rank) % 2 === 0 ? spacingX * .12 : 0),
    y: rank * spacingY
  };
}

function updatePlayer(dt) {
  const length = Math.hypot(input.axisX, input.axisY);
  const ax = length > 1 ? input.axisX / length : input.axisX;
  const ay = length > 1 ? input.axisY / length : input.axisY;
  const radius = 44 + Math.sqrt(Math.max(1, soldiers.length)) * 4.2;
  state.eagle.x = clamp(state.eagle.x + ax * state.moveSpeed * dt, Math.min(radius, W * .25), W - Math.min(radius, W * .25));
  state.eagle.y = clamp(state.eagle.y + ay * state.moveSpeed * dt, Math.max(90, Math.min(radius, H * .25)), H - Math.min(radius, H * .22));
}

function nearestEnemy(x, y, maxRange = Infinity) {
  let best = null;
  let bestD = maxRange;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < bestD) { bestD = d; best = enemy; }
  }
  return best ? { enemy: best, distance: bestD } : null;
}

function updateSoldiers(dt) {
  const total = soldiers.length;
  for (let i = 0; i < soldiers.length; i += 1) {
    const soldier = soldiers[i];
    soldier.attack -= dt;
    soldier.flash = Math.max(0, soldier.flash - dt);
    soldier.maxHp = state.soldierMaxHp;

    const slot = formationSlot(i, total);
    soldier.walkPhase += dt * soldier.strideRate * (Math.hypot(input.axisX, input.axisY) > .08 ? 1 : .18);
    const sway = Math.cos(soldier.walkPhase * .52 + soldier.id * .37) * soldier.swayAmount;
    const gait = Math.sin(soldier.walkPhase) * .55;
    const tx = state.eagle.x + slot.x + sway;
    const ty = state.eagle.y + slot.y + gait;
    const dx = tx - soldier.x;
    const dy = ty - soldier.y;
    const dist = Math.hypot(dx, dy) || 1;
    const catchup = Math.min(state.moveSpeed * 1.14 + dist * 2.5, 390);
    soldier.x += dx / dist * catchup * dt;
    soldier.y += dy / dist * catchup * dt;

    const target = nearestEnemy(soldier.x, soldier.y, 30);
    if (target && soldier.attack <= 0) {
      soldier.attack = state.attackRate * rand(.84, 1.18);
      target.enemy.hp -= state.soldierDamage;
      target.enemy.flash = .09;
      addParticles(target.enemy.x, target.enemy.y, '#bda57a', 2);
      if (target.enemy.hp <= 0) killEnemy(target.enemy);
    }
  }
  soldiers = soldiers.filter(soldier => soldier.hp > 0);
}

function pickEnemyTarget(enemy) {
  let bestSoldier = null;
  let bestD = 88;
  for (const soldier of soldiers) {
    const d = Math.hypot(enemy.x - soldier.x, enemy.y - soldier.y);
    if (d < bestD) { bestD = d; bestSoldier = soldier; }
  }
  if (bestSoldier) return { kind: 'soldier', target: bestSoldier, distance: bestD };
  return { kind: 'eagle', target: state.eagle, distance: Math.hypot(enemy.x - state.eagle.x, enemy.y - state.eagle.y) };
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const def = ENEMIES[enemy.type];
    enemy.attack -= dt;
    enemy.rangedAttack -= dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    const targetInfo = pickEnemyTarget(enemy);
    const target = targetInfo.target;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (def.ranged && targetInfo.distance < 185 && targetInfo.distance > 72) {
      if (enemy.rangedAttack <= 0) {
        enemy.rangedAttack = 1.7;
        if (targetInfo.kind === 'soldier') {
          target.hp -= enemy.damage * .75;
          target.flash = .13;
        } else {
          damageEagle(enemy.damage * .65);
        }
        projectiles.push({ x: enemy.x, y: enemy.y, tx: target.x, ty: target.y, life: .18, maxLife: .18, enemy: true });
      }
      const tangent = (enemy.id % 2 ? 1 : -1);
      enemy.x += (-dy / dist) * enemy.speed * .25 * tangent * dt;
      enemy.y += (dx / dist) * enemy.speed * .25 * tangent * dt;
      continue;
    }

    const hitRange = targetInfo.kind === 'soldier' ? def.radius + 6 : def.radius + 17;
    if (dist <= hitRange) {
      if (enemy.attack <= 0) {
        enemy.attack = def.rate;
        if (targetInfo.kind === 'soldier') {
          target.hp -= enemy.damage;
          target.flash = .13;
          addParticles(target.x, target.y, '#8d332c', 2);
        } else {
          damageEagle(enemy.damage);
        }
      }
    } else {
      enemy.x += dx / dist * enemy.speed * dt;
      enemy.y += dy / dist * enemy.speed * dt;
    }
  }
  enemies = enemies.filter(enemy => !enemy.dead && enemy.hp > 0);
}

function updateReinforcements(dt) {
  for (const group of reinforcements) {
    if (group.dead) continue;
    group.attack -= dt;
    group.flash = Math.max(0, group.flash - dt);
    const dx = state.eagle.x - group.x;
    const dy = state.eagle.y - group.y;
    const dist = Math.hypot(dx, dy) || 1;
    const intercept = nearestEnemy(group.x, group.y, 34);
    if (intercept) {
      if (group.attack <= 0) {
        group.attack = .7;
        intercept.enemy.hp -= Math.max(4, group.count * state.soldierDamage * .22);
        group.hp -= ENEMIES[intercept.enemy.type].damage * .7;
        group.flash = .12;
        intercept.enemy.flash = .1;
        if (intercept.enemy.hp <= 0) killEnemy(intercept.enemy);
        const survivors = Math.max(0, Math.ceil(group.hp / (state.soldierMaxHp * .82)));
        group.count = Math.min(group.count, survivors);
        if (group.count <= 0 || group.hp <= 0) {
          group.dead = true;
          call('A reinforcement cohort was cut down.', 1.5);
          addParticles(group.x, group.y, '#a63c33', 12);
          continue;
        }
      }
    }
    group.x += dx / dist * group.speed * dt;
    group.y += dy / dist * group.speed * dt;
    if (dist < 48 + Math.sqrt(Math.max(1, soldiers.length)) * 2.5) {
      const count = group.count;
      addLegionaries(count, group.x, group.y);
      group.dead = true;
      state.score += count * 18;
      cue('join');
      call(`${count} legionaries joined the Eagle. Legion: ${soldiers.length}`, 1.8);
      addParticles(group.x, group.y, '#e1b64e', 12);
    }
  }
  reinforcements = reinforcements.filter(group => !group.dead);
}

function updateRangedSupport(dt) {
  if (state.levels.pila > 0) {
    state.pilaTimer -= dt;
    if (state.pilaTimer <= 0) {
      state.pilaTimer = Math.max(1.05, 2.25 - state.levels.pila * .13);
      const shots = Math.min(enemies.length, 2 + state.levels.pila * 2);
      const targets = [...enemies].filter(e => !e.dead).sort((a, b) => distance(a, state.eagle) - distance(b, state.eagle)).slice(0, shots);
      for (const target of targets) {
        const angle = rand(0, TAU);
        const sx = state.eagle.x + Math.cos(angle) * rand(25, 70);
        const sy = state.eagle.y + Math.sin(angle) * rand(20, 58);
        target.hp -= 8 + state.levels.pila * 4;
        target.flash = .12;
        projectiles.push({ x: sx, y: sy, tx: target.x, ty: target.y, life: .17, maxLife: .17, enemy: false });
        if (target.hp <= 0) killEnemy(target);
      }
      if (targets.length) tone(520, 240, .06, .014, 'square');
    }
  }

  if (state.levels.auxilia > 0) {
    state.auxiliaTimer -= dt;
    if (state.auxiliaTimer <= 0) {
      state.auxiliaTimer = Math.max(.85, 2.7 - state.levels.auxilia * .18);
      const shots = Math.min(enemies.length, 1 + state.levels.auxilia * 2);
      const targets = [...enemies].filter(e => !e.dead).sort((a, b) => distance(a, state.eagle) - distance(b, state.eagle)).slice(0, shots);
      for (const target of targets) {
        target.hp -= 6 + state.levels.auxilia * 3;
        projectiles.push({ x: state.eagle.x + rand(-70, 70), y: state.eagle.y + rand(-45, 45), tx: target.x, ty: target.y, life: .22, maxLife: .22, enemy: false, arrow: true });
        if (target.hp <= 0) killEnemy(target);
      }
    }
  }
}

function damageEagle(amount) {
  const actual = amount * (1 - state.eagleArmor);
  state.eagleHp = Math.max(0, state.eagleHp - actual);
  cue('eagle');
  addParticles(state.eagle.x, state.eagle.y, '#e2b148', 5);
  if (state.eagleHp <= 0) finishGame();
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  const def = ENEMIES[enemy.type];
  state.kills += 1;
  state.denarii += def.reward;
  state.score += 28 + def.reward * 12 + state.wave * 2;
  cue('kill');
  addParticles(enemy.x, enemy.y, '#252c25', 5 + def.reward);
}

function addParticles(x, y, color, count) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = reduced ? Math.ceil(count / 3) : count;
  for (let i = 0; i < total; i += 1) {
    const life = rand(.25, .65);
    particles.push({ x, y, vx: rand(-80, 80), vy: rand(-80, 80), life, maxLife: life, color, size: rand(2, 4.5) });
  }
}

function updateWave(dt) {
  state.waveElapsed += dt;
  state.spawnTimer -= dt;
  if (state.spawnRemaining > 0 && state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnRemaining -= 1;
    state.spawnTimer = Math.max(.16, .65 - state.wave * .014) * rand(.75, 1.24);
  }
  if (state.reinforcementIndex < state.reinforcementTimes.length && state.waveElapsed >= state.reinforcementTimes[state.reinforcementIndex]) {
    state.reinforcementIndex += 1;
    spawnReinforcement();
  }
  if (state.spawnRemaining === 0 && enemies.length === 0 && reinforcements.length === 0) {
    if (state.reinforcementIndex < state.reinforcementTimes.length) {
      state.reinforcementIndex += 1;
      spawnReinforcement();
    } else {
      completeWave();
    }
  }
}

function upgradeLevel(key) {
  if (key === 'recruits') return state.purchases.recruits;
  return state.levels[key] || 0;
}

function upgradeCost(def) {
  return Math.ceil(def.base + upgradeLevel(def.key) * def.growth);
}

function renderShop() {
  ui.shopGrid.replaceChildren();
  for (const def of UPGRADE_DEFS) {
    const cost = upgradeCost(def);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-card';
    button.disabled = state.denarii < cost;
    button.innerHTML = `<strong>${def.title}</strong><span>${def.desc}</span><em>${cost} denarii · level ${upgradeLevel(def.key) + 1}</em>`;
    button.addEventListener('click', () => buyUpgrade(def));
    ui.shopGrid.append(button);
  }
  ui.shopSummary.textContent = `${state.denarii} denarii available · ${soldiers.length} legionaries around the Aquila · buy as many reforms as you can afford.`;
}

function buyUpgrade(def) {
  if (status !== 'between-rounds') return;
  const cost = upgradeCost(def);
  if (state.denarii < cost) return;
  state.denarii -= cost;
  state.purchases[def.key] = (state.purchases[def.key] || 0) + 1;
  def.apply(state);
  cue('buy');
  renderShop();
  updateHud();
}

function completeWave() {
  if (status !== 'playing') return;
  status = 'between-rounds';
  priorStatus = 'between-rounds';
  input.reset?.();
  state.score += 140 + state.wave * 55 + soldiers.length * 2;
  state.eagleHp = Math.min(state.eagleMaxHp, state.eagleHp + 12);
  for (const soldier of soldiers) soldier.hp = Math.min(soldier.maxHp, soldier.hp + soldier.maxHp * .28);
  ui.waveComplete.textContent = `WAVE ${state.wave} HELD`;
  renderShop();
  ui.shopOverlay.hidden = false;
  callTimer = 0;
  ui.battleCall.classList.remove('show');
  updateHud();
}

function nextWave() {
  if (status !== 'between-rounds') return;
  state.wave += 1;
  status = 'playing';
  priorStatus = 'playing';
  ui.shopOverlay.hidden = true;
  input.reset?.();
  lastFrame = performance.now();
  beginWave();
}

function finishGame() {
  if (!state || state.ended) return;
  state.ended = true;
  status = 'game-over';
  paused = false;
  input.reset?.();
  cue('gameover');
  const final = Math.max(0, Math.floor(state.score));
  ui.finalScore.textContent = final.toLocaleString();
  ui.peak.textContent = state.peakLegion.toLocaleString();
  ui.finalKills.textContent = state.kills.toLocaleString();
  ui.endSummary.textContent = `The Aquila reached wave ${state.wave}. The legion peaked at ${state.peakLegion} men and cut down ${state.kills} enemies before the standard fell.`;
  ui.endOverlay.hidden = false;
  if (!scoreSubmitted) {
    scoreSubmitted = true;
    window.EscapeeScores?.submit(final, {
      sortValue: final,
      label: 'Legion score',
      display: `Wave ${state.wave} · ${state.kills} kills · peak legion ${state.peakLegion}`
    });
  }
}

function update(dt) {
  if (!state || status !== 'playing' || paused) return;
  callTimer -= dt;
  if (callTimer <= 0) ui.battleCall.classList.remove('show');
  updatePlayer(dt);
  updateWave(dt);
  updateSoldiers(dt);
  updateEnemies(dt);
  updateReinforcements(dt);
  updateRangedSupport(dt);

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= .95;
    particle.vy *= .95;
    particle.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const shot of projectiles) shot.life -= dt;
  projectiles = projectiles.filter(shot => shot.life > 0);

  state.peakLegion = Math.max(state.peakLegion, soldiers.length);
  updateHud();
}

function updateHud() {
  if (!state) return;
  ui.wave.textContent = String(state.wave);
  ui.legion.textContent = String(soldiers.length);
  ui.eagle.textContent = String(Math.max(0, Math.ceil(state.eagleHp)));
  ui.denarii.textContent = String(Math.floor(state.denarii));
  ui.kills.textContent = state.kills.toLocaleString();
  ui.score.textContent = Math.floor(state.score).toLocaleString();
}

function drawGround() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#7d6344');
  grad.addColorStop(.55, '#6d5438');
  grad.addColorStop(1, '#58412e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#33251c25';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const y = 40 + i * Math.max(35, H / 11);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(W * .45, y + Math.sin(i * 1.7) * 18, W, y - 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#c8ad7650';
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 139 + state.wave * 31) % (W + 100) - 50;
    const y = 60 + (i * 91) % Math.max(100, H - 80);
    ctx.beginPath();
    ctx.ellipse(x, y, 12 + (i % 4) * 5, 3 + (i % 3), .2 * (i % 4), 0, TAU);
    ctx.fill();
  }
}

function drawSoldier(soldier) {
  const flash = soldier.flash > 0;
  const marching = status === 'playing' && Math.hypot(input.axisX, input.axisY) > .06;
  const bob = Math.sin(soldier.walkPhase) * (marching ? 1.1 : .2);
  const step = Math.sin(soldier.walkPhase) * (marching ? 2.1 : .25);
  ctx.save();
  ctx.translate(soldier.x, soldier.y + bob);
  ctx.fillStyle = '#4a2b22';
  ctx.fillRect(-3 + step * .34, 4, 2, 3);
  ctx.fillRect(1 - step * .34, 4, 2, 3);
  ctx.fillStyle = flash ? '#fff1d0' : '#a43830';
  ctx.fillRect(-4.5, -4, 9, 9);
  ctx.fillStyle = '#d9c59c';
  ctx.fillRect(-4.5, -6, 9, 2.5);
  ctx.fillStyle = '#7b2d28';
  ctx.beginPath(); ctx.arc(-5, 1, 4, 0, TAU); ctx.fill();
  if (soldier.hp < soldier.maxHp * .55) {
    ctx.fillStyle = '#261b17aa'; ctx.fillRect(-6, -10, 12, 2);
    ctx.fillStyle = '#e9ce84'; ctx.fillRect(-6, -10, 12 * clamp(soldier.hp / soldier.maxHp, 0, 1), 2);
  }
  ctx.restore();
}

function drawEagle() {
  const radius = 34 + Math.sqrt(Math.max(1, soldiers.length)) * 5;
  ctx.strokeStyle = '#e8c55d29';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(state.eagle.x, state.eagle.y, radius, 0, TAU); ctx.stroke();

  ctx.save();
  ctx.translate(state.eagle.x, state.eagle.y);
  const pulse = 1 + Math.sin(performance.now() * .006) * .045;
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#f0cd65';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -30); ctx.stroke();
  ctx.fillStyle = '#e0ad37';
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.lineTo(-13, -24); ctx.lineTo(-5, -23); ctx.lineTo(0, -14); ctx.lineTo(5, -23); ctx.lineTo(13, -24); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a7362e';
  ctx.fillRect(3, -11, 17, 12);
  ctx.restore();
}

function drawEnemy(enemy) {
  const def = ENEMIES[enemy.type];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.flash > 0 ? '#efe4d1' : def.color;
  if (enemy.type === 'horseman') {
    ctx.beginPath(); ctx.ellipse(0, 2, 11, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#bcae91'; ctx.beginPath(); ctx.arc(4, -6, 3, 0, TAU); ctx.fill();
  } else if (enemy.type === 'champion') {
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c6ad77'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, def.radius, 0, TAU); ctx.fill();
    if (enemy.type === 'spearman') {
      ctx.strokeStyle = '#d2c3a0'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 15); ctx.stroke();
    }
    if (enemy.type === 'skirmisher') {
      ctx.strokeStyle = '#b08b5f'; ctx.beginPath(); ctx.arc(5, 0, 6, -1.2, 1.2); ctx.stroke();
    }
  }
  if (enemy.hp < enemy.maxHp * .7) {
    ctx.fillStyle = '#1c1714aa'; ctx.fillRect(-8, -15, 16, 2);
    ctx.fillStyle = '#c9b37d'; ctx.fillRect(-8, -15, 16 * clamp(enemy.hp / enemy.maxHp, 0, 1), 2);
  }
  ctx.restore();
}

function drawReinforcement(group) {
  const visible = Math.max(1, Math.min(8, group.count));
  ctx.save();
  ctx.translate(group.x, group.y);
  const marchTime = performance.now() * .007;
  for (let i = 0; i < visible; i += 1) {
    const col = i % 3 - 1;
    const row = Math.floor(i / 3);
    const bob = Math.sin(marchTime + group.id * .31 + i * .82) * 1.05;
    const step = Math.sin(marchTime + group.id * .31 + i * .82) * 1.5;
    ctx.fillStyle = '#4a2b22';
    ctx.fillRect(col * 10 - 2.5 + step * .25, row * 9 - 2 + bob, 1.5, 2.5);
    ctx.fillRect(col * 10 + .8 - step * .25, row * 9 - 2 + bob, 1.5, 2.5);
    ctx.fillStyle = group.flash > 0 ? '#fff0c9' : '#b24a3c';
    ctx.fillRect(col * 10 - 3.5, row * 9 - 9, 7, 7);
    ctx.fillStyle = '#d5c194';
    ctx.fillRect(col * 10 - 3.5, row * 9 - 11, 7, 2);
  }
  ctx.strokeStyle = '#efd16d';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(16, -16); ctx.lineTo(16, 16); ctx.stroke();
  ctx.fillStyle = '#b23830'; ctx.fillRect(16, -16, 15, 9);
  ctx.fillStyle = '#fff1bd'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(group.count), 0, 22);
  ctx.restore();
}

function drawProjectiles() {
  for (const shot of projectiles) {
    ctx.globalAlpha = clamp(shot.life / shot.maxLife, 0, 1);
    ctx.strokeStyle = shot.enemy ? '#493c32' : shot.arrow ? '#e4d3a4' : '#f0cf76';
    ctx.lineWidth = shot.enemy ? 1.7 : 2.3;
    ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.tx, shot.ty); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  if (!state) {
    ctx.fillStyle = '#6d5438';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  drawGround();
  for (const group of reinforcements) drawReinforcement(group);
  for (const enemy of enemies) drawEnemy(enemy);
  for (const soldier of soldiers) drawSoldier(soldier);
  drawProjectiles();
  drawEagle();
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
ui.nextWaveButton.addEventListener('click', nextWave);

const primeAudioAfterStart = () => {
  if (status !== 'playing' || muted || audio) return;
  initAudio();
};
addEventListener('pointerdown', primeAudioAfterStart, { capture: true, passive: true });
addEventListener('keydown', primeAudioAfterStart, { capture: true });

window.EscapeeGame = {
  restart: startGame,
  pause() {
    if (!state || status === 'menu' || status === 'game-over') return;
    priorStatus = status;
    paused = true;
    status = 'paused';
    input.reset?.();
  },
  resume() {
    if (!state || status !== 'paused') return;
    status = priorStatus === 'between-rounds' ? 'between-rounds' : 'playing';
    paused = false;
    input.reset?.();
    lastFrame = performance.now();
  },
  setMuted(value) { muted = Boolean(value); },
  getStatus() { return status; }
};

addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 80));
resize();
requestAnimationFrame(frame);
