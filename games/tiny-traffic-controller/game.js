(() => {
  'use strict';

  const canvas = document.querySelector('#canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const ui = {
    score: document.querySelector('#score'),
    time: document.querySelector('#time'),
    cleared: document.querySelector('#cleared'),
    lives: document.querySelector('#lives'),
    status: document.querySelector('#status'),
    warning: document.querySelector('#warning'),
    startOverlay: document.querySelector('#startOverlay'),
    endOverlay: document.querySelector('#endOverlay'),
    switchButton: document.querySelector('#switchButton'),
    repairButton: document.querySelector('#repairButton'),
    repairCount: document.querySelector('#repairCount'),
    startButton: document.querySelector('#startButton'),
    restartButton: document.querySelector('#restartButton'),
    summary: document.querySelector('#summary'),
    finalScore: document.querySelector('#finalScore'),
    bestScore: document.querySelector('#bestScore')
  };

  const SIDES = ['N', 'S', 'E', 'W'];
  const COLORS = ['#e65b4f', '#4aa3df', '#f3b941', '#8d68c4', '#46b58a'];
  const PHASE = {
    NS_GREEN: 'ns-green',
    NS_YELLOW: 'ns-yellow',
    ALL_RED_EW: 'all-red-ew',
    EW_GREEN: 'ew-green',
    EW_YELLOW: 'ew-yellow',
    ALL_RED_NS: 'all-red-ns'
  };

  let width = 1;
  let height = 1;
  let dpr = 1;
  let lastFrame = null;
  let state = 'title';
  let paused = false;
  let muted = false;
  let elapsed = 0;
  let score = 0;
  let cleared = 0;
  let lives = 3;
  let phase = PHASE.NS_GREEN;
  let phaseTimer = 0;
  let spawnTimer = 0;
  let vehicles = [];
  let pedestrians = [];
  let train = null;
  let repairHits = 0;
  let recoveryTimer = 0;
  let warningTimer = 0;
  let nextId = 1;
  let audioContext = null;

  function readBest() {
    try {
      return Number(JSON.parse(localStorage.getItem('escapee:tiny-traffic-controller:best') || '0')) || 0;
    } catch {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem('escapee:tiny-traffic-controller:best', JSON.stringify(value));
    } catch {}
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function tone(frequency = 440, duration = 0.06) {
    if (muted) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      if (!audioContext) audioContext = new AudioCtor();
      audioContext.resume?.().catch?.(() => {});
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {}
  }

  function warn(text, good = false) {
    ui.warning.textContent = text;
    ui.warning.style.background = good ? '#267a55f2' : '#9e3029f2';
    ui.warning.classList.add('show');
    clearTimeout(warningTimer);
    warningTimer = setTimeout(() => ui.warning.classList.remove('show'), 1300);
  }

  function activeAxis() {
    if (phase === PHASE.NS_GREEN || phase === PHASE.NS_YELLOW) return 'NS';
    if (phase === PHASE.EW_GREEN || phase === PHASE.EW_YELLOW) return 'EW';
    return null;
  }

  function sideAxis(side) {
    return side === 'N' || side === 'S' ? 'NS' : 'EW';
  }

  function isGreen() {
    return phase === PHASE.NS_GREEN || phase === PHASE.EW_GREEN;
  }

  function updateHud() {
    ui.score.textContent = Math.floor(score).toLocaleString();
    ui.time.textContent = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
    ui.cleared.textContent = String(cleared);
    ui.lives.textContent = `${'● '.repeat(lives)}${'○ '.repeat(3 - lives)}`.trim();

    const labels = {
      [PHASE.NS_GREEN]: 'North–South Green',
      [PHASE.NS_YELLOW]: 'North–South Yellow',
      [PHASE.ALL_RED_EW]: pedestrians.length ? 'All Stop · Pedestrians Crossing' : 'All Stop',
      [PHASE.EW_GREEN]: 'East–West Green',
      [PHASE.EW_YELLOW]: 'East–West Yellow',
      [PHASE.ALL_RED_NS]: pedestrians.length ? 'All Stop · Pedestrians Crossing' : 'All Stop'
    };
    ui.status.textContent = labels[phase] || 'All Stop';
    ui.switchButton.textContent = phase === PHASE.NS_GREEN ? 'Switch to East–West' : phase === PHASE.EW_GREEN ? 'Switch to North–South' : labels[phase];
    ui.switchButton.disabled = state !== 'playing' || paused || !isGreen() || repairHits > 0 || recoveryTimer > 0;
    ui.repairButton.hidden = repairHits <= 0;
    ui.repairCount.textContent = String(repairHits);
  }

  function reset() {
    elapsed = 0;
    score = 0;
    cleared = 0;
    lives = 3;
    phase = PHASE.NS_GREEN;
    phaseTimer = 0;
    spawnTimer = 0.55;
    vehicles = [];
    pedestrians = [];
    train = null;
    repairHits = 0;
    recoveryTimer = 0;
    nextId = 1;
    paused = false;
    state = 'playing';
    lastFrame = null;
    ui.startOverlay.hidden = true;
    ui.endOverlay.hidden = true;
    updateHud();
  }

  function switchLights() {
    if (state !== 'playing' || paused || !isGreen() || repairHits > 0 || recoveryTimer > 0) return;
    phase = phase === PHASE.NS_GREEN ? PHASE.NS_YELLOW : PHASE.EW_YELLOW;
    phaseTimer = 1.1;
    tone(520);
    updateHud();
  }

  function createPedestrians() {
    if (elapsed < 75) return;
    const horizontal = phase === PHASE.ALL_RED_EW;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i += 1) {
      pedestrians.push({ horizontal, progress: -i * 0.14, speed: 0.43 + Math.random() * 0.08, lane: i % 2 });
    }
  }

  function updateSignal(dt) {
    if (isGreen()) return;
    phaseTimer -= dt;
    const pedestriansDone = pedestrians.every(person => person.progress >= 1);
    const allRed = phase === PHASE.ALL_RED_EW || phase === PHASE.ALL_RED_NS;
    if (phaseTimer > 0 || (allRed && !pedestriansDone)) return;

    if (phase === PHASE.NS_YELLOW) {
      phase = PHASE.ALL_RED_EW;
      phaseTimer = 1;
      createPedestrians();
    } else if (phase === PHASE.EW_YELLOW) {
      phase = PHASE.ALL_RED_NS;
      phaseTimer = 1;
      createPedestrians();
    } else if (phase === PHASE.ALL_RED_EW) {
      pedestrians = [];
      phase = PHASE.EW_GREEN;
      tone(660);
    } else {
      pedestrians = [];
      phase = PHASE.NS_GREEN;
      tone(660);
    }
    updateHud();
  }

  function difficulty() {
    return Math.min(1, elapsed / 360);
  }

  function spawnVehicle() {
    const side = SIDES[Math.floor(Math.random() * SIDES.length)];
    const roll = Math.random();
    const route = elapsed < 45 ? 'straight' : elapsed < 90 ? (roll < 0.72 ? 'straight' : 'right') : (roll < 0.56 ? 'straight' : roll < 0.79 ? 'right' : 'left');
    const emergency = elapsed >= 150 && Math.random() < 0.1 + difficulty() * 0.05;
    vehicles.push({
      id: nextId++,
      side,
      route,
      progress: -0.04,
      speed: (emergency ? 0.112 : 0.076) + difficulty() * 0.035 + Math.random() * 0.012,
      patience: emergency ? 5.5 : Math.max(7, 11 - difficulty() * 3),
      deadline: emergency ? 9 : Infinity,
      emergency,
      committed: false,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    });
  }

  function geometry() {
    const cx = width / 2;
    const cy = height / 2;
    const road = Math.max(86, Math.min(width, height) * 0.25);
    return { cx, cy, road, half: road / 2, lane: road * 0.2, margin: 55 };
  }

  function routePoints(vehicle) {
    const { cx, cy, half, lane, margin } = geometry();
    const start = {
      N: { x: cx - lane, y: -margin }, S: { x: cx + lane, y: height + margin },
      E: { x: width + margin, y: cy - lane }, W: { x: -margin, y: cy + lane }
    }[vehicle.side];
    const entry = {
      N: { x: cx - lane, y: cy - half }, S: { x: cx + lane, y: cy + half },
      E: { x: cx + half, y: cy - lane }, W: { x: cx - half, y: cy + lane }
    }[vehicle.side];
    const straight = {
      N: { x: cx - lane, y: height + margin }, S: { x: cx + lane, y: -margin },
      E: { x: -margin, y: cy - lane }, W: { x: width + margin, y: cy + lane }
    }[vehicle.side];
    const left = {
      N: { x: width + margin, y: cy + lane }, S: { x: -margin, y: cy - lane },
      E: { x: cx - lane, y: height + margin }, W: { x: cx + lane, y: -margin }
    }[vehicle.side];
    const right = {
      N: { x: -margin, y: cy - lane }, S: { x: width + margin, y: cy + lane },
      E: { x: cx + lane, y: -margin }, W: { x: cx - lane, y: height + margin }
    }[vehicle.side];
    return { start, entry, center: { x: cx, y: cy }, end: vehicle.route === 'left' ? left : vehicle.route === 'right' ? right : straight };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function curve(a, b, c, t) {
    const n = 1 - t;
    return n * n * a + 2 * n * t * b + t * t * c;
  }

  function pose(vehicle) {
    const points = routePoints(vehicle);
    const p = Math.max(0, vehicle.progress);
    let x;
    let y;
    let nx;
    let ny;
    if (p <= 0.42) {
      const t = p / 0.42;
      const n = Math.min(1, t + 0.03);
      x = lerp(points.start.x, points.entry.x, t);
      y = lerp(points.start.y, points.entry.y, t);
      nx = lerp(points.start.x, points.entry.x, n);
      ny = lerp(points.start.y, points.entry.y, n);
    } else {
      const t = Math.min(1, (p - 0.42) / 0.58);
      const n = Math.min(1, t + 0.03);
      if (vehicle.route === 'straight') {
        x = lerp(points.entry.x, points.end.x, t);
        y = lerp(points.entry.y, points.end.y, t);
        nx = lerp(points.entry.x, points.end.x, n);
        ny = lerp(points.entry.y, points.end.y, n);
      } else {
        x = curve(points.entry.x, points.center.x, points.end.x, t);
        y = curve(points.entry.y, points.center.y, points.end.y, t);
        nx = curve(points.entry.x, points.center.x, points.end.x, n);
        ny = curve(points.entry.y, points.center.y, points.end.y, n);
      }
    }
    return { x, y, angle: Math.atan2(ny - y, nx - x) };
  }

  function mayEnter(vehicle) {
    if (vehicle.committed || vehicle.progress >= 0.42) return true;
    if (activeAxis() !== sideAxis(vehicle.side)) return false;
    if (isGreen()) return true;
    return (phase === PHASE.NS_YELLOW || phase === PHASE.EW_YELLOW) && vehicle.progress >= 0.34;
  }

  function trainBlocks(vehicle) {
    return Boolean(train && vehicle.side === 'E' && vehicle.progress < 0.34);
  }

  function pedestrianPosition(person) {
    const { cx, cy, road, half } = geometry();
    const offset = person.lane ? 7 : -7;
    return person.horizontal
      ? { x: cx - half - 14 + person.progress * (road + 28), y: cy - half - 10 + offset }
      : { x: cx + half + 10 + offset, y: cy - half - 14 + person.progress * (road + 28) };
  }

  function crash(reason) {
    if (recoveryTimer > 0 || state !== 'playing') return;
    lives -= 1;
    recoveryTimer = 1.2;
    vehicles = vehicles.filter(vehicle => vehicle.progress < 0.28 || vehicle.progress > 0.82);
    pedestrians = [];
    phase = PHASE.ALL_RED_NS;
    phaseTimer = 1;
    warn(reason);
    tone(110, 0.22);
    if (lives <= 0) finish();
    updateHud();
  }

  function updateVehicles(dt) {
    const groups = new Map(SIDES.map(side => [side, []]));
    for (const vehicle of vehicles) groups.get(vehicle.side).push(vehicle);
    for (const group of groups.values()) group.sort((a, b) => b.progress - a.progress);

    for (const group of groups.values()) {
      for (let index = 0; index < group.length; index += 1) {
        const vehicle = group[index];
        const leader = group[index - 1];
        const tooClose = leader && leader.progress - vehicle.progress < 0.09 && vehicle.progress < 0.42;
        const atStop = vehicle.progress >= 0.34 && vehicle.progress < 0.42;
        const blocked = tooClose || (atStop && (!mayEnter(vehicle) || trainBlocks(vehicle)));

        if (blocked) {
          vehicle.patience -= dt;
          if (vehicle.emergency) vehicle.deadline -= dt;
          if (vehicle.emergency && vehicle.deadline <= 0) return crash('Emergency vehicle delayed');
          if (!vehicle.emergency && vehicle.patience <= 0 && Math.random() < dt * 0.9) vehicle.committed = true;
        } else {
          vehicle.progress += vehicle.speed * dt;
          if (vehicle.progress >= 0.42) vehicle.committed = true;
          if (vehicle.emergency && vehicle.progress < 0.42) vehicle.deadline -= dt * 0.18;
        }
      }
    }

    for (let i = 0; i < vehicles.length; i += 1) {
      const first = vehicles[i];
      if (first.progress < 0.41 || first.progress > 0.76) continue;
      const a = pose(first);
      for (let j = i + 1; j < vehicles.length; j += 1) {
        const second = vehicles[j];
        if (second.progress < 0.41 || second.progress > 0.76 || first.side === second.side) continue;
        const b = pose(second);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 18) return crash('Collision!');
      }
    }

    for (const person of pedestrians) {
      if (person.progress < 0 || person.progress > 1) continue;
      const point = pedestrianPosition(person);
      for (const vehicle of vehicles) {
        if (vehicle.progress < 0.4 || vehicle.progress > 0.76) continue;
        const position = pose(vehicle);
        if (Math.hypot(point.x - position.x, point.y - position.y) < 14) return crash('Pedestrian struck');
      }
    }

    vehicles = vehicles.filter(vehicle => {
      if (vehicle.progress < 1.03) return true;
      cleared += 1;
      score += vehicle.emergency ? 25 + Math.max(0, vehicle.deadline) * 3 : 2;
      if (vehicle.emergency) warn('Emergency cleared', true);
      return false;
    });
  }

  function updateEvents(dt) {
    for (const person of pedestrians) person.progress += person.speed * dt;

    if (elapsed >= 210) {
      if (!train && Math.random() < dt * (0.012 + difficulty() * 0.012)) {
        train = { timer: 5 + Math.random() * 2.5, travel: 0 };
        warn('Train approaching');
        tone(260, 0.12);
      }
      if (train) {
        train.timer -= dt;
        train.travel += dt;
        if (train.timer <= 0) train = null;
      }
    }

    if (elapsed >= 240 && repairHits === 0 && Math.random() < dt * (0.018 + difficulty() * 0.012)) {
      repairHits = 3;
      warn('Signal malfunction');
      updateHud();
    }
  }

  function finish() {
    if (state === 'game-over') return;
    state = 'game-over';
    const final = Math.max(0, Math.floor(score));
    const best = Math.max(final, readBest());
    writeBest(best);
    ui.finalScore.textContent = final.toLocaleString();
    ui.bestScore.textContent = best.toLocaleString();
    ui.summary.textContent = `${ui.time.textContent} survived · ${cleared} vehicles cleared`;
    ui.endOverlay.hidden = false;
    updateHud();
    window.EscapeeScores?.submit(final, { label: 'Final score', display: `${final.toLocaleString()} points` });
  }

  function update(dt) {
    if (recoveryTimer > 0) {
      recoveryTimer -= dt;
      if (recoveryTimer <= 0 && lives > 0) {
        phase = PHASE.NS_GREEN;
        phaseTimer = 0;
      }
      updateHud();
      return;
    }

    elapsed += dt;
    score += dt * 2;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnVehicle();
      spawnTimer = Math.max(0.52, 1.55 - elapsed * 0.0025) + Math.random() * 0.42;
    }
    updateSignal(dt);
    updateEvents(dt);
    updateVehicles(dt);
    updateHud();
  }

  function drawRoads() {
    const { cx, cy, road, half } = geometry();
    ctx.fillStyle = '#4b7359';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#30383d';
    ctx.fillRect(cx - half, 0, road, height);
    ctx.fillRect(0, cy - half, width, road);
    ctx.strokeStyle = '#e8d98b';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f7f2de';
    for (let i = -2; i <= 2; i += 1) {
      const offset = i * 12;
      ctx.fillRect(cx - half + offset, cy - half - 12, 7, 10);
      ctx.fillRect(cx - half + offset, cy + half + 2, 7, 10);
      ctx.fillRect(cx - half - 12, cy - half + offset, 10, 7);
      ctx.fillRect(cx + half + 2, cy - half + offset, 10, 7);
    }

    if (train) {
      const trackX = cx + half + road * 0.34;
      ctx.fillStyle = '#684a38';
      ctx.fillRect(trackX - 12, 0, 5, height);
      ctx.fillRect(trackX + 7, 0, 5, height);
      ctx.fillStyle = '#b6a487';
      for (let y = -20; y < height + 20; y += 24) ctx.fillRect(trackX - 15, y, 30, 5);
      const trainY = ((train.travel * 120) % (height + 220)) - 110;
      ctx.fillStyle = '#bd493d';
      ctx.fillRect(trackX - 23, trainY, 46, 120);
      ctx.fillStyle = '#f2c65d';
      ctx.fillRect(trackX - 16, trainY + 12, 32, 10);
    }
  }

  function drawSignals() {
    const { cx, cy, half } = geometry();
    const nsGreen = phase === PHASE.NS_GREEN;
    const ewGreen = phase === PHASE.EW_GREEN;
    const nsYellow = phase === PHASE.NS_YELLOW;
    const ewYellow = phase === PHASE.EW_YELLOW;
    const lights = [
      [cx - half - 20, cy - half - 20, nsGreen, nsYellow],
      [cx + half + 20, cy + half + 20, nsGreen, nsYellow],
      [cx + half + 20, cy - half - 20, ewGreen, ewYellow],
      [cx - half - 20, cy + half + 20, ewGreen, ewYellow]
    ];
    for (const [x, y, green, yellow] of lights) {
      ctx.fillStyle = repairHits > 0 && Math.floor(elapsed * 8) % 2 ? '#54292a' : '#142126';
      ctx.fillRect(x - 9, y - 13, 18, 26);
      ctx.fillStyle = yellow ? '#ffd84a' : green ? '#56d37a' : '#ef554d';
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawVehicles() {
    for (const vehicle of vehicles) {
      const position = pose(vehicle);
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(position.angle);
      ctx.fillStyle = vehicle.emergency ? '#f5f7fb' : vehicle.color;
      ctx.fillRect(-13, -7.5, 26, 15);
      ctx.fillStyle = '#172126';
      ctx.fillRect(-8, -5.5, 10, 11);
      ctx.fillStyle = vehicle.route === 'left' ? '#ffdb57' : vehicle.route === 'right' ? '#7ee6ff' : '#eef4f6';
      ctx.fillRect(7, -2, 4, 4);
      if (vehicle.emergency) {
        ctx.fillStyle = Math.floor(elapsed * 8) % 2 ? '#6ed5ff' : '#ff5f5f';
        ctx.fillRect(-5, -10, 10, 3);
      }
      ctx.restore();
    }
  }

  function drawPedestrians() {
    ctx.fillStyle = '#f6d365';
    for (const person of pedestrians) {
      if (person.progress < 0 || person.progress > 1) continue;
      const point = pedestrianPosition(person);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawRoads();
    drawPedestrians();
    drawVehicles();
    drawSignals();
  }

  function frame(timestamp) {
    if (lastFrame === null) lastFrame = timestamp;
    const dt = Math.max(0, Math.min((timestamp - lastFrame) / 1000, 0.05));
    lastFrame = timestamp;
    if (state === 'playing' && !paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function repair() {
    if (state !== 'playing' || paused || repairHits <= 0) return;
    repairHits -= 1;
    tone(720);
    if (repairHits === 0) warn('Lights repaired', true);
    updateHud();
  }

  function inputLocked(event) {
    if (event?.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return true;
    const scoreOverlay = document.querySelector('.escapee-score-overlay');
    return Boolean(scoreOverlay && !scoreOverlay.hidden);
  }

  function handleKey(event) {
    if (inputLocked(event)) return;
    if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
      switchLights();
    }
    if (event.code === 'KeyR') {
      event.preventDefault();
      repair();
    }
  }

  function handleTap(event) {
    if (state !== 'playing' || paused) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { cx, cy, road } = geometry();
    if (Math.abs(x - cx) <= road || Math.abs(y - cy) <= road) switchLights();
  }

  ui.startButton.addEventListener('click', reset);
  ui.restartButton.addEventListener('click', reset);
  ui.switchButton.addEventListener('click', switchLights);
  ui.repairButton.addEventListener('click', repair);
  canvas.addEventListener('pointerdown', handleTap);
  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  window.EscapeeGame = {
    restart: reset,
    pause() {
      if (state !== 'playing') return;
      paused = true;
      lastFrame = null;
      updateHud();
    },
    resume() {
      if (state !== 'playing') return;
      paused = false;
      lastFrame = null;
      updateHud();
    },
    setMuted(value) {
      muted = Boolean(value);
    },
    getStatus() {
      return paused && state === 'playing' ? 'paused' : state;
    }
  };

  resize();
  updateHud();
  requestAnimationFrame(frame);
})();
