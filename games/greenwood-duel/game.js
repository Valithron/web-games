const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');

const $ = selector => document.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const TAU = Math.PI * 2;
const GRAVITY = 232;
const WIND_ACCELERATION = 2.35;
const CHARACTER_ORDER = ['sterling', 'ryan', 'cooper'];
const CHARACTERS = {
  sterling: { name: 'Sterling', skin: '#e7b37d', hair: '#33251f', hat: '#244f3c', shirt: '#1f5a46', trim: '#d4a64e', pants: '#273d3a', boots: '#573b2b' },
  ryan: { name: 'Ryan', skin: '#e3ad78', hair: '#793e2c', hat: '#783f2e', shirt: '#a34f31', trim: '#e1b050', pants: '#4b3430', boots: '#513326' },
  cooper: { name: 'Cooper', skin: '#dfa473', hair: '#d3b35d', hat: '#a06a36', shirt: '#8a6b35', trim: '#e4c66c', pants: '#315044', boots: '#503829' }
};

const SPRITE_DIR = './assets/archers/';
const SPRITE_META = {
  logicalWidth: 64,
  logicalHeight: 80,
  baseline: 79,
  anchors: {
    arrowReleaseOrigin: [35, 29],
    headBounds: [21, 8, 22, 21],
    torsoBounds: [19, 28, 26, 26]
  }
};

const spriteSets = Object.fromEntries(CHARACTER_ORDER.map(key => {
  const makeImage = file => {
    const image = new Image();
    image.decoding = 'async';
    image.src = `${SPRITE_DIR}${file}`;
    return image;
  };
  return [key, {
    body: makeImage(`${key}-body.png`),
    aim: makeImage(`${key}-aim.png`),
    release: makeImage(`${key}-release.png`),
    idles: makeImage(`${key}-idles.png`)
  }];
}));

const state = {
  status: 'menu',
  paused: false,
  resumeStatus: 'menu',
  muted: readMuted(),
  viewW: 0,
  viewH: 0,
  previousBaseY: 0,
  match: null,
  playerKey: null,
  opponentKey: null,
  streak: 0,
  score: 0,
  playerShotsThisDuel: 0,
  playerAimAngle: 42,
  playerAimPower: 68,
  drag: null,
  betweenUntil: 0,
  impactUntil: 0,
  impactResult: null,
  aiElapsed: 0,
  aiPlan: null,
  aiObservation: null,
  rng: Math.random,
  cameraX: 0,
  cameraY: 0,
  runFinished: false,
  scoreSubmitted: false
};

let audioContext = null;
let lastFrame = performance.now();

function readMuted() {
  try { return localStorage.getItem('greenwood-duel:muted') === '1'; } catch { return false; }
}

function saveMuted() {
  try { localStorage.setItem('greenwood-duel:muted', state.muted ? '1' : '0'); } catch {}
}

function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function ensureAudio() {
  if (state.muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch { audioContext = null; }
}

function tone(frequency, duration = 0.08, type = 'square', volume = 0.035, slide = 0) {
  if (state.muted) return;
  try {
    ensureAudio();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  } catch {}
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || window.innerWidth);
  const height = Math.max(1, rect.height || window.innerHeight);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const oldBase = state.previousBaseY || height * 0.76;
  const newBase = height * 0.76;
  if (state.match && Math.abs(newBase - oldBase) > 0.1) {
    const shift = newBase - oldBase;
    for (const arrow of state.match.arrows) {
      arrow.y += shift;
      arrow.prevY += shift;
    }
  }
  state.viewW = width;
  state.viewH = height;
  state.previousBaseY = newBase;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (state.match) {
    state.match.baseY = newBase;
    state.cameraX = clamp(state.cameraX, 0, Math.max(0, state.match.worldWidth - width));
  }
}

function terrainYAt(x) {
  const match = state.match;
  if (!match?.terrain?.length) return state.viewH * 0.76;
  const points = match.terrain;
  if (x <= points[0].x) return match.baseY + points[0].offset;
  if (x >= points.at(-1).x) return match.baseY + points.at(-1).offset;
  const index = clamp(Math.floor(x / match.terrainStep), 0, points.length - 2);
  const left = points[index];
  const right = points[index + 1];
  const amount = clamp((x - left.x) / (right.x - left.x), 0, 1);
  return match.baseY + lerp(left.offset, right.offset, amount);
}

function screenToWorld(x, y) {
  return { x: x + state.cameraX, y: y + state.cameraY };
}

function currentShooter() {
  return state.match?.turn === 'player' ? state.match.player : state.match?.opponent;
}

function chooseOpponent() {
  const available = CHARACTER_ORDER.filter(key => key !== state.playerKey);
  return available[Math.floor(state.rng() * available.length)];
}

function setupMatch() {
  const width = state.viewW;
  const playerX = clamp(width * 0.15, 70, 150);
  const distanceFloor = Math.max(190, width * 0.56);
  const distanceCeiling = Math.max(distanceFloor + 20, width * 0.84 + state.streak * 18);
  const distance = clamp(distanceFloor + state.rng() * (distanceCeiling - distanceFloor) + state.streak * 8, distanceFloor, distanceCeiling);
  const opponentX = playerX + distance;
  const worldWidth = Math.max(width + 680, opponentX + 440);
  const terrainStep = clamp(width * 0.2, 64, 104);
  const terrain = [];
  let offset = 0;
  const pointCount = Math.ceil(worldWidth / terrainStep) + 1;
  for (let index = 0; index < pointCount; index += 1) {
    offset = clamp(offset + (state.rng() - 0.5) * 54, -72, 68);
    if (index === 0 || index === pointCount - 1) offset = 0;
    terrain.push({ x: index * terrainStep, offset });
  }
  const maxWind = clamp(5 + state.streak * 1.4, 5, 18);
  let wind = Math.round((state.rng() * 2 - 1) * maxWind);
  if (Math.abs(wind) < 2) wind = 0;
  const treeCount = Math.ceil(worldWidth / 230);
  const scenery = Array.from({ length: treeCount }, (_, index) => ({
    x: clamp(70 + index * (worldWidth - 140) / Math.max(1, treeCount - 1) + (state.rng() - 0.5) * 70, 30, worldWidth - 30),
    scale: 0.75 + state.rng() * 0.55,
    layer: state.rng() > 0.45 ? 0 : 1
  }));

  state.match = {
    worldWidth,
    terrainStep,
    terrain,
    scenery,
    baseY: state.viewH * 0.76,
    wind,
    player: { x: playerX, facing: 1, health: 100, hitTimer: 0, releaseStartedAt: 0, releaseUntil: 0, idleGroup: 0 },
    opponent: { x: opponentX, facing: -1, health: 100, hitTimer: 0, releaseStartedAt: 0, releaseUntil: 0, idleGroup: 1 },
    arrows: [],
    turn: 'player',
    drawProgress: 0
  };
  state.cameraY = 0;
  state.cameraX = clamp((playerX + opponentX) / 2 - width / 2, 0, Math.max(0, worldWidth - width));
  state.playerShotsThisDuel = 0;
  state.aiObservation = null;
  state.aiPlan = null;
  state.impactResult = null;
  state.status = 'playing';
  updateUi();
  tone(300, 0.08, 'triangle', 0.025, 70);
}

function startRun(characterKey) {
  ensureAudio();
  state.paused = false;
  state.resumeStatus = null;
  state.playerKey = characterKey;
  state.opponentKey = chooseOpponent();
  state.streak = 0;
  state.score = 0;
  state.runFinished = false;
  state.scoreSubmitted = false;
  state.rng = seededRandom(randomSeed());
  $('#start-overlay').classList.add('hidden');
  $('#gameover-overlay').classList.add('hidden');
  setupMatch();
}

function startNextDuel() {
  $('#round-overlay').classList.add('hidden');
  state.opponentKey = chooseOpponent();
  setupMatch();
}

function showCharacterSelect() {
  $('#gameover-overlay').classList.add('hidden');
  $('#round-overlay').classList.add('hidden');
  $('#start-overlay').classList.remove('hidden');
  state.match = null;
  state.status = 'menu';
  updateUi();
}

function updateUi() {
  const match = state.match;
  const player = match?.player;
  const opponent = match?.opponent;
  $('#player-name').textContent = state.playerKey ? CHARACTERS[state.playerKey].name.toUpperCase() : 'PLAYER';
  $('#opponent-name').textContent = state.opponentKey ? CHARACTERS[state.opponentKey].name.toUpperCase() : 'OPPONENT';
  $('#player-health').textContent = String(Math.max(0, Math.round(player?.health ?? 100)));
  $('#opponent-health').textContent = String(Math.max(0, Math.round(opponent?.health ?? 100)));
  $('#streak').textContent = String(state.streak);
  $('#score').textContent = state.score.toLocaleString();
  if (match) {
    $('#wind-label').textContent = match.wind === 0 ? 'WIND · CALM' : `WIND ${match.wind < 0 ? '←' : '→'} ${Math.abs(match.wind)}`;
  } else $('#wind-label').textContent = 'WIND --';
  let label = 'Choose your archer';
  if (state.status === 'playing') label = 'YOUR TURN · AIM';
  if (state.status === 'flying') label = 'ARROW IN FLIGHT';
  if (state.status === 'ai-aiming') label = `${CHARACTERS[state.opponentKey]?.name.toUpperCase()} IS DRAWING`;
  if (state.status === 'impact') label = state.impactResult?.label || 'IMPACT';
  if (state.status === 'between-rounds') label = 'DUEL WON';
  if (state.status === 'game-over') label = 'RUN ENDED';
  $('#turn-label').textContent = label;
  const canAim = state.status === 'playing' && !state.paused;
  $('#aim-panel').hidden = !canAim;
  $('#fire').disabled = !canAim || getAimMode() !== 'sliders';
  $('#angle-value').textContent = `${Math.round(state.playerAimAngle)}°`;
  $('#power-value').textContent = `${Math.round(state.playerAimPower)}%`;
}

function getAimMode() {
  try { return localStorage.getItem('greenwood-duel:aim-mode') === 'sliders' ? 'sliders' : 'drag'; } catch { return 'drag'; }
}

function setAimMode(mode) {
  try { localStorage.setItem('greenwood-duel:aim-mode', mode); } catch {}
  const sliders = mode === 'sliders';
  $('#aim-mode').textContent = sliders ? 'AIM MODE: SLIDERS' : 'AIM MODE: DRAG';
  $('#aim-mode').setAttribute('aria-pressed', String(sliders));
  $('#slider-controls').classList.toggle('is-disabled', !sliders);
  $('#drag-hint').textContent = sliders
    ? 'Set Angle and Power, then press Fire. The dotted arc includes gravity and wind.'
    : 'Drag back from your archer to draw. The dotted arc shows the exact flight path. Release to fire.';
  updateUi();
}

function getAimVelocity(shooter, angle = state.playerAimAngle, power = state.playerAimPower, direction = 1) {
  const radians = angle * Math.PI / 180;
  const speed = 280 + power / 100 * 520;
  return { vx: Math.cos(radians) * speed * direction, vy: -Math.sin(radians) * speed };
}

// The preview intentionally uses the same fixed physics step as the live
// projectile. This keeps the guide honest when wind or frame timing changes.
function predictAimPath(shooter, angle, power, direction = 1) {
  const origin = spriteAnchorWorld(shooter, SPRITE_META.anchors.arrowReleaseOrigin);
  const velocity = getAimVelocity(shooter, angle, power, direction);
  const points = [{ x: origin.x, y: origin.y }];
  const target = direction === 1 ? state.match?.opponent : state.match?.player;
  const step = 1 / 60;
  let x = origin.x;
  let y = origin.y;
  let vx = velocity.vx;
  let vy = velocity.vy;
  let impact = null;

  for (let index = 0; index < 360; index += 1) {
    const previousX = x;
    const previousY = y;
    vy += GRAVITY * step;
    vx += state.match.wind * WIND_ACCELERATION * step;
    x += vx * step;
    y += vy * step;

    const terrainT = segmentTerrainT(previousX, previousY, x, y);
    let bodyT = null;
    if (target) {
      for (const region of hitRegions(target)) {
        const hitT = segmentRectT(previousX, previousY, x, y, region.rect);
        if (hitT !== null && (bodyT === null || hitT < bodyT)) bodyT = hitT;
      }
    }

    const collisionT = bodyT !== null && (terrainT === null || bodyT <= terrainT) ? bodyT : terrainT;
    if (collisionT !== null) {
      impact = { x: lerp(previousX, x, collisionT), y: lerp(previousY, y, collisionT) };
      points.push(impact);
      break;
    }

    points.push({ x, y });
    if (y > state.match.baseY + 300 || x < -200 || x > state.match.worldWidth + 200) break;
  }
  return { points, impact };
}

function firePlayer() {
  if (state.status !== 'playing' || !state.match) return;
  const shooter = state.match.player;
  state.match.turn = 'player';
  state.playerShotsThisDuel += 1;
  state.match.drawProgress = 1;
  createArrow(shooter, getAimVelocity(shooter), 'player');
  tone(160, 0.12, 'sawtooth', 0.035, 90);
  tone(680, 0.22, 'triangle', 0.018, -330);
}

function createArrow(shooter, velocity, owner) {
  const origin = spriteAnchorWorld(shooter, SPRITE_META.anchors.arrowReleaseOrigin);
  const now = performance.now();
  shooter.releaseStartedAt = now;
  shooter.releaseUntil = now + 260;
  const arrow = {
    x: origin.x,
    y: origin.y,
    prevX: origin.x,
    prevY: origin.y,
    vx: velocity.vx,
    vy: velocity.vy,
    angle: Math.atan2(velocity.vy, velocity.vx),
    owner,
    embedded: false,
    kind: 'ground',
    target: null,
    region: null,
    impactX: null,
    impactY: null
  };
  state.match.arrows.push(arrow);
  state.status = 'flying';
  state.match.drawProgress = 0;
  updateUi();
}

function prepareAiTurn() {
  state.status = 'ai-aiming';
  state.aiElapsed = 0;
  state.aiPlan = calculateAiPlan();
  state.match.turn = 'ai';
  state.match.drawProgress = 0;
  updateUi();
}

function calculateAiPlan() {
  const shooter = state.match.opponent;
  const target = state.match.player;
  const base = findBallisticSolution(shooter, target);
  const correction = state.aiObservation ? clamp((target.x - state.aiObservation.landX) * 0.18, -70, 70) : 0;
  const verticalCorrection = state.aiObservation ? clamp((state.aiObservation.landY - (terrainYAt(target.x) - 39)) * 0.028, -4, 5) : 0;
  const angleError = 8.5 - Math.min(4.5, state.streak * 0.42);
  const powerError = 76 - Math.min(42, state.streak * 3.6);
  const angle = clamp(base.angle + verticalCorrection + (state.rng() - 0.5) * angleError, 15, 78);
  const power = clamp(base.power + correction + (state.rng() - 0.5) * powerError, 20, 100);
  return { angle, power };
}

function findBallisticSolution(shooter, target) {
  const direction = -1;
  const targetY = terrainYAt(target.x) - 40;
  let best = { angle: 45, power: 68, score: Infinity };
  for (let angle = 20; angle <= 76; angle += 2) {
    for (let power = 30; power <= 100; power += 3) {
      const velocity = getAimVelocity(shooter, angle, power, direction);
      let x = shooter.x - 20;
      let y = terrainYAt(shooter.x) - 39;
      let vx = velocity.vx;
      let vy = velocity.vy;
      let previousX = x;
      let previousY = y;
      let closest = Infinity;
      let targetCrossY = y;
      let blocked = false;
      for (let step = 0; step < 150; step += 1) {
        previousX = x;
        previousY = y;
        vy += GRAVITY * 0.025;
        vx += state.match.wind * WIND_ACCELERATION * 0.025;
        x += vx * 0.025;
        y += vy * 0.025;
        const xDistance = Math.abs(x - target.x);
        const pointScore = xDistance + Math.abs(y - targetY) * 1.3;
        if (pointScore < closest) {
          closest = pointScore;
          targetCrossY = y;
        }
        if (segmentTerrainT(previousX, previousY, x, y) !== null && step > 5) {
          blocked = true;
          break;
        }
        if (direction * (x - target.x) > 40 && step > 15) break;
      }
      const score = closest + Math.abs(targetCrossY - targetY) * 0.7 + (blocked ? 290 : 0);
      if (score < best.score) best = { angle, power, score };
    }
  }
  return best;
}

function segmentTerrainT(x1, y1, x2, y2) {
  const f1 = y1 - terrainYAt(x1);
  const f2 = y2 - terrainYAt(x2);
  if (f1 < 0 && f2 >= 0) {
    let low = 0;
    let high = 1;
    for (let index = 0; index < 10; index += 1) {
      const middle = (low + high) / 2;
      const x = lerp(x1, x2, middle);
      const y = lerp(y1, y2, middle);
      if (y - terrainYAt(x) >= 0) high = middle;
      else low = middle;
    }
    return high;
  }
  return null;
}

function segmentRectT(x1, y1, x2, y2, rect) {
  let tMin = 0;
  let tMax = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [origin, delta, min, max] of [[x1, dx, rect.x, rect.x + rect.w], [y1, dy, rect.y, rect.y + rect.h]]) {
    if (Math.abs(delta) < 0.00001) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let entry = (min - origin) / delta;
    let exit = (max - origin) / delta;
    if (entry > exit) [entry, exit] = [exit, entry];
    tMin = Math.max(tMin, entry);
    tMax = Math.min(tMax, exit);
    if (tMin > tMax) return null;
  }
  return tMin >= 0 && tMin <= 1 ? tMin : null;
}

function hitRegions(target) {
  const scale = spriteScale();
  const feet = terrainYAt(target.x);
  const armBoxes = [
    [7, 32, 12, 21],
    [45, 32, 12, 21]
  ];
  const toWorldRect = ([x, y, w, h]) => ({
    x: target.x + (target.facing === 1 ? x - 32 : 32 - (x + w)) * scale,
    y: feet + (y - SPRITE_META.baseline) * scale,
    w: w * scale,
    h: h * scale
  });
  return [
    { name: 'HEADSHOT', damage: 100, rect: toWorldRect(SPRITE_META.anchors.headBounds) },
    { name: 'TORSO', damage: 50, rect: toWorldRect(SPRITE_META.anchors.torsoBounds) },
    ...armBoxes.map(box => ({ name: 'ARM', damage: 34, rect: toWorldRect(box) })),
    { name: 'LEG', damage: 34, rect: toWorldRect([19, 51, 26, 28]) }
  ];
}

function updateArrow(arrow, dt) {
  if (arrow.embedded) return;
  arrow.prevX = arrow.x;
  arrow.prevY = arrow.y;
  arrow.vy += GRAVITY * dt;
  arrow.vx += state.match.wind * WIND_ACCELERATION * dt;
  arrow.x += arrow.vx * dt;
  arrow.y += arrow.vy * dt;
  arrow.angle = Math.atan2(arrow.vy, arrow.vx);
  const target = arrow.owner === 'player' ? state.match.opponent : state.match.player;
  const terrainT = segmentTerrainT(arrow.prevX, arrow.prevY, arrow.x, arrow.y);
  let regionHit = null;
  for (const region of hitRegions(target)) {
    const hitT = segmentRectT(arrow.prevX, arrow.prevY, arrow.x, arrow.y, region.rect);
    if (hitT !== null && (!regionHit || hitT < regionHit.t)) regionHit = { ...region, t: hitT };
  }
  if (regionHit && (terrainT === null || regionHit.t <= terrainT)) {
    const t = regionHit.t;
    arrow.x = lerp(arrow.prevX, arrow.x, t);
    arrow.y = lerp(arrow.prevY, arrow.y, t);
    arrow.embedded = true;
    arrow.kind = 'body';
    arrow.target = target;
    arrow.region = regionHit.name;
    arrow.impactX = arrow.x;
    arrow.impactY = arrow.y;
    target.health = Math.max(0, target.health - regionHit.damage);
    target.hitTimer = 0.36;
    state.impactResult = { label: regionHit.name, owner: arrow.owner, target, killed: target.health <= 0 };
    if (regionHit.name === 'HEADSHOT') tone(135, 0.22, 'square', 0.05, -95);
    else tone(90, 0.1, 'triangle', 0.04, -35);
    if (arrow.owner === 'player') {
      state.score += regionHit.name === 'HEADSHOT' ? 500 : regionHit.name === 'TORSO' ? 100 : 50;
    } else {
      state.aiObservation = { landX: arrow.x, landY: arrow.y };
    }
    beginImpactPause();
    return;
  }
  if (terrainT !== null) {
    arrow.x = lerp(arrow.prevX, arrow.x, terrainT);
    arrow.y = terrainYAt(arrow.x);
    arrow.embedded = true;
    arrow.kind = 'ground';
    arrow.impactX = arrow.x;
    arrow.impactY = arrow.y;
    if (arrow.owner === 'ai') state.aiObservation = { landX: arrow.x, landY: arrow.y };
    tone(70, 0.11, 'triangle', 0.035, -20);
    state.impactResult = { label: 'GROUND', owner: arrow.owner, target: null, killed: false };
    beginImpactPause();
  }
  if (arrow.y > state.match.baseY + 300 || arrow.x < -200 || arrow.x > state.match.worldWidth + 200) {
    arrow.embedded = true;
    arrow.kind = 'ground';
    arrow.impactX = clamp(arrow.x, 0, state.match.worldWidth);
    arrow.impactY = terrainYAt(arrow.impactX);
    state.impactResult = { label: 'MISS', owner: arrow.owner, target: null, killed: false };
    if (arrow.owner === 'ai') state.aiObservation = { landX: arrow.x, landY: arrow.y };
    beginImpactPause();
  }
}

function beginImpactPause() {
  state.status = 'impact';
  state.impactUntil = performance.now() + 430;
  updateUi();
}

function finishImpact() {
  const result = state.impactResult;
  if (!result) return;
  if (result.killed) {
    if (result.owner === 'player') winDuel();
    else finishRun(false);
    return;
  }
  if (result.owner === 'player') prepareAiTurn();
  else {
    state.match.turn = 'player';
    state.status = 'playing';
    state.match.drawProgress = 0;
    updateUi();
  }
}

function winDuel() {
  state.streak += 1;
  state.score += 10000;
  if (state.playerShotsThisDuel === 1) state.score += 500;
  state.status = 'between-rounds';
  state.betweenUntil = performance.now() + 1450;
  $('#round-title').textContent = `${CHARACTERS[state.opponentKey].name} is beaten.`;
  $('#round-summary').textContent = `Streak ${state.streak}. Health restored. The next field will bring a new wind and range.`;
  $('#round-overlay').classList.remove('hidden');
  tone(420, 0.14, 'triangle', 0.04, 160);
  tone(630, 0.22, 'triangle', 0.035, 190);
  updateUi();
}

function finishRun(playerWon = false) {
  if (state.runFinished) return;
  state.runFinished = true;
  state.status = 'game-over';
  state.scoreSubmitted = true;
  $('#round-overlay').classList.add('hidden');
  $('#gameover-eyebrow').textContent = playerWon ? 'RUN COMPLETE' : 'RUN ENDED';
  $('#gameover-title').textContent = playerWon ? 'A perfect headshot.' : 'The grove falls silent.';
  $('#gameover-summary').textContent = `You won ${state.streak} duel${state.streak === 1 ? '' : 's'} and finished with a score of ${state.score.toLocaleString()}.`;
  $('#final-score').textContent = state.score.toLocaleString();
  $('#gameover-overlay').classList.remove('hidden');
  $('#aim-panel').hidden = true;
  if (playerWon) tone(730, 0.3, 'triangle', 0.045, 210);
  else tone(120, 0.35, 'sawtooth', 0.04, -65);
  window.EscapeeScores?.submit(state.score, {
    label: 'Win streak score',
    display: `${state.streak} wins · ${state.score.toLocaleString()} points`
  });
  updateUi();
}

function update(dt, now) {
  const match = state.match;
  if (!match) return;
  match.player.hitTimer = Math.max(0, match.player.hitTimer - dt);
  match.opponent.hitTimer = Math.max(0, match.opponent.hitTimer - dt);
  if (state.status === 'playing') {
    match.drawProgress = Math.min(1, match.drawProgress + dt * 5);
  }
  if (state.status === 'ai-aiming') {
    state.aiElapsed += dt;
    match.drawProgress = Math.min(1, state.aiElapsed / 0.9);
    if (state.aiElapsed >= 1.08) {
      const plan = state.aiPlan || { angle: 45, power: 65 };
      createArrow(match.opponent, getAimVelocity(match.opponent, plan.angle, plan.power, -1), 'ai');
      tone(155, 0.12, 'sawtooth', 0.03, 85);
      tone(600, 0.2, 'triangle', 0.015, -250);
    }
  }
  if (state.status === 'flying') {
    const flying = match.arrows.find(arrow => !arrow.embedded);
    if (flying) updateArrow(flying, dt);
  }
  if (state.status === 'impact' && now >= state.impactUntil) finishImpact();
  if (state.status === 'between-rounds' && now >= state.betweenUntil) startNextDuel();
  if (state.status === 'flying') {
    const flying = match.arrows.find(arrow => !arrow.embedded);
    if (flying) {
      const desiredX = flying.x - state.viewW * 0.52;
      state.cameraX += (clamp(desiredX, 0, Math.max(0, match.worldWidth - state.viewW)) - state.cameraX) * Math.min(1, dt * 4.5);
      const desiredY = clamp(flying.y - state.viewH * 0.38, 0, 130);
      state.cameraY += (desiredY - state.cameraY) * Math.min(1, dt * 4);
    }
  } else {
    const desiredX = (match.player.x + match.opponent.x) / 2 - state.viewW / 2;
    state.cameraX += (clamp(desiredX, 0, Math.max(0, match.worldWidth - state.viewW)) - state.cameraX) * Math.min(1, dt * 3);
    state.cameraY += (0 - state.cameraY) * Math.min(1, dt * 3);
  }
  updateUi();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.viewH);
  gradient.addColorStop(0, '#87c9c0');
  gradient.addColorStop(0.62, '#b4d4bb');
  gradient.addColorStop(1, '#5d9c77');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.viewW, state.viewH);
  ctx.fillStyle = 'rgba(255,241,177,.75)';
  ctx.beginPath(); ctx.arc(state.viewW * 0.78, state.viewH * 0.18, Math.min(42, state.viewW * 0.1), 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,239,.47)';
  for (const cloud of [[.16,.18,1],[.39,.11,.75],[.65,.27,.9]]) {
    const x = cloud[0] * state.viewW;
    const y = cloud[1] * state.viewH;
    ctx.fillRect(x - 38 * cloud[2], y, 78 * cloud[2], 10 * cloud[2]);
    ctx.fillRect(x - 20 * cloud[2], y - 7 * cloud[2], 36 * cloud[2], 15 * cloud[2]);
  }
  if (state.match) {
    drawHillLayer('#5f9b83', 0.23, 0.12);
    drawHillLayer('#3f7868', 0.37, 0.2);
  }
}

function drawHillLayer(color, heightRatio, parallax) {
  const offset = -state.cameraX * parallax;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, state.viewH);
  ctx.lineTo(0, state.viewH * (1 - heightRatio));
  for (let x = -100; x <= state.viewW + 140; x += 110) {
    const world = x - offset;
    const y = state.viewH * (1 - heightRatio) + Math.sin(world / 180) * state.viewH * 0.045 + Math.sin(world / 75) * state.viewH * 0.018;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(state.viewW, state.viewH); ctx.closePath(); ctx.fill();
}

function drawScenery() {
  for (const item of state.match.scenery) {
    const x = item.x - state.cameraX;
    const ground = terrainYAt(item.x) - state.cameraY;
    if (x < -100 || x > state.viewW + 100) continue;
    const scale = item.scale * clamp(state.viewW / 760, 0.75, 1.25);
    ctx.save();
    ctx.globalAlpha = item.layer === 0 ? 0.62 : 0.9;
    ctx.fillStyle = item.layer === 0 ? '#315d57' : '#204e43';
    ctx.fillRect(x - 3 * scale, ground - 92 * scale, 6 * scale, 92 * scale);
    ctx.fillRect(x - 22 * scale, ground - 82 * scale, 44 * scale, 18 * scale);
    ctx.fillRect(x - 30 * scale, ground - 62 * scale, 60 * scale, 18 * scale);
    ctx.fillRect(x - 20 * scale, ground - 103 * scale, 40 * scale, 20 * scale);
    ctx.restore();
  }
}

function drawTerrain() {
  const match = state.match;
  ctx.fillStyle = '#1a4c3d';
  ctx.beginPath();
  ctx.moveTo(-20, state.viewH + 20);
  for (const point of match.terrain) ctx.lineTo(point.x - state.cameraX, terrainYAt(point.x) - state.cameraY);
  ctx.lineTo(state.viewW + 20, state.viewH + 20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#87c777'; ctx.lineWidth = 4; ctx.beginPath();
  match.terrain.forEach((point, index) => {
    const x = point.x - state.cameraX;
    const y = terrainYAt(point.x) - state.cameraY;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = 'rgba(222,217,129,.48)'; ctx.lineWidth = 2;
  for (let x = 12 - (state.cameraX % 37); x < state.viewW; x += 37) {
    const worldX = x + state.cameraX;
    const ground = terrainYAt(worldX) - state.cameraY;
    ctx.beginPath(); ctx.moveTo(x, ground + 2); ctx.lineTo(x + 2, ground - 6); ctx.stroke();
  }
}

function drawArrow(arrow, attached = false) {
  let x = arrow.impactX ?? arrow.x;
  let y = arrow.impactY ?? arrow.y;
  if (attached && arrow.target) {
    const shake = arrow.target.hitTimer > 0 ? Math.sin(arrow.target.hitTimer * 70) * 3 : 0;
    x = arrow.impactX - state.cameraX + shake;
    y = arrow.impactY - state.cameraY;
  } else {
    x -= state.cameraX; y -= state.cameraY;
  }
  const length = 24;
  const dx = Math.cos(arrow.angle) * length;
  const dy = Math.sin(arrow.angle) * length;
  ctx.save();
  ctx.strokeStyle = '#5a3922'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx * 0.55, y + dy * 0.55); ctx.stroke();
  ctx.fillStyle = '#f2d783'; ctx.beginPath(); ctx.moveTo(x + dx * 0.65, y + dy * 0.65); ctx.lineTo(x + dx * 0.2 - dy * .25, y + dy * .2 + dx * .25); ctx.lineTo(x + dx * .2 + dy * .25, y + dy * .2 - dx * .25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x - dx * .55 - dy * .35, y - dy * .55 + dx * .35); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x - dx * .55 + dy * .35, y - dy * .55 - dx * .35); ctx.stroke();
  ctx.restore();
}

function drawArcherFallback(key, archer, facing, drawProgress = 0) {
  const character = CHARACTERS[key];
  const x = archer.x - state.cameraX;
  const feet = terrainYAt(archer.x) - state.cameraY;
  const scale = clamp(state.viewW / 760, .82, 1.45);
  const shake = archer.hitTimer > 0 ? Math.sin(archer.hitTimer * 70) * 3 : 0;
  const bob = archer.hitTimer > 0 ? 0 : Math.sin(performance.now() / 260 + archer.x) * 1.2;
  ctx.save();
  ctx.translate(x + shake, feet + bob);
  ctx.scale(facing * scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(10,35,25,.38)'; ctx.fillRect(-17, -2, 34, 5);
  ctx.fillStyle = character.boots; ctx.fillRect(-11, -21, 8, 20); ctx.fillRect(4, -21, 8, 20);
  ctx.fillStyle = character.pants; ctx.fillRect(-10, -24, 20, 10);
  ctx.fillStyle = character.shirt; ctx.fillRect(-13, -48, 26, 27);
  ctx.fillStyle = character.trim; ctx.fillRect(-2, -47, 4, 25);
  ctx.fillStyle = character.skin; ctx.fillRect(-7, -64, 15, 16);
  ctx.fillStyle = character.hair; ctx.fillRect(-9, -66, 18, 8); ctx.fillRect(-10, -62, 4, 13);
  ctx.fillStyle = character.hat; ctx.fillRect(-12, -72, 24, 6); ctx.fillRect(-6, -78, 12, 8); ctx.fillRect(5, -76, 13, 3);
  ctx.fillStyle = '#38251d'; ctx.fillRect(4, -58, 4, 2);
  ctx.fillStyle = character.skin; ctx.fillRect(8, -44, 16, 5); ctx.fillRect(-22, -43, 13, 5);
  ctx.fillStyle = character.hair; ctx.fillRect(-9, -57, 18, 3);
  const bowX = 22;
  const handX = 8;
  const progress = clamp(drawProgress, 0, 1);
  const aim = key === state.playerKey ? state.playerAimAngle : state.aiPlan?.angle ?? 45;
  const localAngle = aim * Math.PI / 180;
  const pull = progress * 17;
  ctx.strokeStyle = '#6b3e26'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(bowX, -40, 17, -1.18, 1.18); ctx.stroke();
  ctx.strokeStyle = '#f7e3a0'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(bowX + Math.cos(-1.18) * 17, -40 + Math.sin(-1.18) * 17); ctx.lineTo(bowX - pull, -40); ctx.lineTo(bowX + Math.cos(1.18) * 17, -40 + Math.sin(1.18) * 17); ctx.stroke();
  if (progress > 0) {
    const arrowX = handX + Math.cos(localAngle) * (27 + progress * 10);
    const arrowY = -40 - Math.sin(localAngle) * (27 + progress * 10);
    ctx.strokeStyle = '#5a3922'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(handX - 4, -40); ctx.lineTo(arrowX, arrowY); ctx.stroke();
  }
  ctx.restore();
}

function spriteScale() {
  return clamp(state.viewW / 760, .82, 1.45);
}

function spriteAnchorWorld(archer, [nativeX, nativeY]) {
  const scale = spriteScale();
  const feet = terrainYAt(archer.x);
  return {
    x: archer.x + (nativeX - SPRITE_META.logicalWidth / 2) * scale * archer.facing,
    y: feet + (nativeY - SPRITE_META.baseline) * scale
  };
}

function atlasFrame(image, frame, frameWidth = 64, frameHeight = 80) {
  if (!image?.complete || !image.naturalWidth) return false;
  ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, -32, -79, frameWidth, frameHeight);
  return true;
}

function getAimFrame(angle, drawProgress) {
  const angleFrame = clamp(Math.round((angle - 15) / 63 * 4), 0, 4);
  const drawFrame = clamp(Math.round(clamp(drawProgress, 0, 1) * 4), 0, 4);
  return clamp(Math.round(angleFrame * .35 + drawFrame * .65), 0, 4);
}

function drawArcher(key, archer, facing, drawProgress = 0) {
  const sprites = spriteSets[key];
  if (!sprites?.aim?.complete || !sprites.aim.naturalWidth) {
    drawArcherFallback(key, archer, facing, drawProgress);
    return;
  }

  const now = performance.now();
  const scale = spriteScale();
  const x = archer.x - state.cameraX;
  const feet = terrainYAt(archer.x) - state.cameraY;
  const shake = archer.hitTimer > 0 ? Math.sin(archer.hitTimer * 70) * 3 : 0;
  const bob = archer.hitTimer > 0 ? 0 : Math.sin(now / 260 + archer.x) * 1.2;
  const aim = archer === state.match?.player ? state.playerAimAngle : state.aiPlan?.angle ?? 45;
  const isDrawing = archer === state.match?.opponent && state.status === 'ai-aiming'
    ? true
    : archer === state.match?.player && state.status === 'playing' && getAimMode() === 'sliders';

  ctx.save();
  ctx.translate(x + shake, feet + bob);
  ctx.scale(facing * scale, scale);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(10,35,25,.38)';
  ctx.fillRect(-18, -2, 36, 5);

  let drawn = false;
  if (archer.releaseUntil > now) {
    const progress = clamp((now - archer.releaseStartedAt) / 260, 0, 0.999);
    drawn = atlasFrame(sprites.release, Math.floor(progress * 3), 64, 80);
  } else if (isDrawing) {
    drawn = atlasFrame(sprites.aim, getAimFrame(aim, drawProgress), 64, 80);
  } else {
    const groupStart = archer.idleGroup ? 4 : 0;
    const groupLength = archer.idleGroup ? 5 : 4;
    const frame = groupStart + Math.floor(now / 180 + archer.x / 20) % groupLength;
    drawn = atlasFrame(sprites.idles, frame, 64, 80);
  }
  ctx.restore();

  if (!drawn) drawArcherFallback(key, archer, facing, drawProgress);
}

function drawAimGuide() {
  if (state.status !== 'playing') return;
  const player = state.match.player;
  const sliders = getAimMode() === 'sliders';
  if (!state.drag && !sliders) return;
  const path = predictAimPath(player, state.playerAimAngle, state.playerAimPower, 1);
  if (path.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,241,177,.94)';
  ctx.lineWidth = Math.max(2, Math.min(3.5, state.viewW / 240));
  if (state.drag) {
    const origin = path.points[0];
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(origin.x - state.cameraX, origin.y - state.cameraY);
    ctx.lineTo(state.drag.currentX - state.cameraX, state.drag.currentY - state.cameraY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  path.points.forEach((point, index) => {
    const screenX = point.x - state.cameraX;
    const screenY = point.y - state.cameraY;
    if (index === 0) ctx.moveTo(screenX, screenY); else ctx.lineTo(screenX, screenY);
  });
  ctx.stroke();

  // Small markers make the arc readable against bright sky and terrain while
  // keeping the guide from looking like a solid second arrow.
  ctx.fillStyle = 'rgba(255,241,177,.92)';
  for (let index = 6; index < path.points.length; index += 8) {
    const point = path.points[index];
    ctx.beginPath(); ctx.arc(point.x - state.cameraX, point.y - state.cameraY, 2.1, 0, TAU); ctx.fill();
  }
  const origin = path.points[0];
  ctx.fillStyle = 'rgba(255,241,177,.18)';
  ctx.beginPath(); ctx.arc(origin.x - state.cameraX, origin.y - state.cameraY, 24 + state.playerAimPower * .2, 0, TAU); ctx.fill();
  if (path.impact) {
    const impactX = path.impact.x - state.cameraX;
    const impactY = path.impact.y - state.cameraY;
    ctx.strokeStyle = 'rgba(255,244,183,.98)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(impactX, impactY, 8, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(impactX - 12, impactY); ctx.lineTo(impactX + 12, impactY); ctx.moveTo(impactX, impactY - 12); ctx.lineTo(impactX, impactY + 12); ctx.stroke();
  }
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, state.viewW, state.viewH);
  drawBackground();
  if (!state.match) return;
  drawScenery();
  drawTerrain();
  for (const arrow of state.match.arrows.filter(item => item.kind === 'ground')) drawArrow(arrow);
  const playerDraw = state.status === 'playing'
    ? getAimMode() === 'sliders'
      ? clamp((state.playerAimPower - 20) / 80, 0, 1)
      : state.drag ? clamp((state.playerAimPower - 20) / 80, 0, 1) : 0
    : 0;
  const aiDraw = state.status === 'ai-aiming' ? state.match.drawProgress : 0;
  drawAimGuide();
  drawArcher(state.playerKey, state.match.player, 1, playerDraw);
  drawArcher(state.opponentKey, state.match.opponent, -1, aiDraw);
  for (const arrow of state.match.arrows.filter(item => item.kind === 'body')) drawArrow(arrow, true);
  if (state.status === 'flying') {
    const flying = state.match.arrows.find(arrow => !arrow.embedded);
    if (flying) drawArrow({ ...flying, impactX: flying.x, impactY: flying.y });
  }
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function beginDrag(event) {
  if (state.status !== 'playing' || getAimMode() !== 'drag') return;
  const point = pointerPosition(event);
  const origin = spriteAnchorWorld(state.match.player, SPRITE_META.anchors.arrowReleaseOrigin);
  const playerScreenX = origin.x - state.cameraX;
  const playerScreenY = origin.y - state.cameraY;
  if (Math.hypot(point.x - playerScreenX, point.y - playerScreenY) > Math.max(115, state.viewW * .3)) return;
  state.drag = { pointerId: event.pointerId, startX: origin.x, startY: origin.y, currentX: point.x + state.cameraX, currentY: point.y + state.cameraY };
  canvas.setPointerCapture?.(event.pointerId);
  updateDrag(point);
  event.preventDefault();
}

function updateDrag(point) {
  if (!state.drag) return;
  state.drag.currentX = point.x + state.cameraX;
  state.drag.currentY = point.y + state.cameraY;
  const dx = Math.max(10, state.drag.startX - state.drag.currentX);
  const dy = state.drag.startY - state.drag.currentY;
  state.playerAimAngle = clamp(Math.atan2(dy, dx) * 180 / Math.PI, 15, 78);
  const length = Math.hypot(state.drag.startX - state.drag.currentX, state.drag.startY - state.drag.currentY);
  state.playerAimPower = clamp(20 + length / 2.6, 20, 100);
  $('#angle').value = String(Math.round(state.playerAimAngle));
  $('#power').value = String(Math.round(state.playerAimPower));
  updateUi();
}

function endDrag(event, shouldFire) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  const enough = Math.hypot(state.drag.startX - state.drag.currentX, state.drag.startY - state.drag.currentY) > 18;
  state.drag = null;
  if (shouldFire && enough && state.status === 'playing') firePlayer();
  event.preventDefault();
}

function handleKeydown(event) {
  if (event.target?.closest?.('input,textarea,[contenteditable="true"],.escapee-score-overlay')) return;
  if (state.status === 'playing' && getAimMode() === 'sliders') {
    if (event.code === 'ArrowUp') { state.playerAimAngle = clamp(state.playerAimAngle + 1, 15, 78); event.preventDefault(); }
    if (event.code === 'ArrowDown') { state.playerAimAngle = clamp(state.playerAimAngle - 1, 15, 78); event.preventDefault(); }
    if (event.code === 'ArrowRight') { state.playerAimPower = clamp(state.playerAimPower + 1, 20, 100); event.preventDefault(); }
    if (event.code === 'ArrowLeft') { state.playerAimPower = clamp(state.playerAimPower - 1, 20, 100); event.preventDefault(); }
    if (event.code === 'Space') { event.preventDefault(); firePlayer(); }
    $('#angle').value = String(Math.round(state.playerAimAngle));
    $('#power').value = String(Math.round(state.playerAimPower));
    updateUi();
  }
  if (state.status === 'between-rounds' && event.code === 'Space') { event.preventDefault(); startNextDuel(); }
}

function loop(now) {
  const dt = Math.min(Math.max(0, now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (!state.paused) update(dt, now);
  render();
  requestAnimationFrame(loop);
}

window.EscapeeGame = {
  restart() {
    if (!state.playerKey) return;
    startRun(state.playerKey);
  },
  pause() {
    if (state.status === 'menu' || state.status === 'game-over') return;
    state.resumeStatus = state.status;
    state.paused = true;
    state.status = 'paused';
    state.drag = null;
  },
  resume() {
    if (!state.paused) return;
    state.paused = false;
    state.status = state.resumeStatus || 'playing';
    state.resumeStatus = null;
    lastFrame = performance.now();
    updateUi();
  },
  setMuted(muted) { state.muted = Boolean(muted); saveMuted(); },
  getMuted() { return state.muted; },
  getStatus() { return state.status; }
};

canvas.addEventListener('pointerdown', beginDrag, { passive: false });
canvas.addEventListener('pointermove', event => { if (state.drag && event.pointerId === state.drag.pointerId) { updateDrag(pointerPosition(event)); event.preventDefault(); } }, { passive: false });
canvas.addEventListener('pointerup', event => endDrag(event, true), { passive: false });
canvas.addEventListener('pointercancel', event => endDrag(event, false), { passive: false });
canvas.addEventListener('lostpointercapture', event => endDrag(event, false), { passive: false });
window.addEventListener('keydown', handleKeydown, { passive: false });
window.addEventListener('blur', () => { state.drag = null; });
window.addEventListener('resize', resizeCanvas);
window.visualViewport?.addEventListener('resize', resizeCanvas);

$('#aim-mode').addEventListener('click', () => setAimMode(getAimMode() === 'drag' ? 'sliders' : 'drag'));
$('#angle').addEventListener('input', event => { state.playerAimAngle = Number(event.target.value); updateUi(); });
$('#power').addEventListener('input', event => { state.playerAimPower = Number(event.target.value); updateUi(); });
$('#fire').addEventListener('click', firePlayer);
document.querySelectorAll('.character-choice').forEach(button => button.addEventListener('click', () => startRun(button.dataset.character)));
$('#next-duel').addEventListener('click', startNextDuel);
$('#play-again').addEventListener('click', () => startRun(state.playerKey));
$('#change-archer').addEventListener('click', showCharacterSelect);

resizeCanvas();
setAimMode(getAimMode());
requestAnimationFrame(loop);
