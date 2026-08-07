(() => {
  'use strict';

  const app = document.querySelector('#app');
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const hud = document.querySelector('#hud');
  const touchControls = document.querySelector('#touchControls');
  const menuScreen = document.querySelector('#menuScreen');
  const summaryScreen = document.querySelector('#summaryScreen');
  const finalScreen = document.querySelector('#finalScreen');
  const upgradeList = document.querySelector('#upgradeList');
  const timeValue = document.querySelector('#timeValue');
  const scoreValue = document.querySelector('#scoreValue');
  const depthValue = document.querySelector('#depthValue');
  const bankValue = document.querySelector('#bankValue');
  const rigValue = document.querySelector('#rigValue');
  const menuDepthValue = document.querySelector('#menuDepthValue');
  const sessionValue = document.querySelector('#sessionValue');
  const doneBtn = document.querySelector('#doneBtn');
  const toast = document.querySelector('#toast');
  const leftBtn = document.querySelector('#leftBtn');
  const rightBtn = document.querySelector('#rightBtn');
  const soundBtn = document.querySelector('#soundBtn');

  const SAVE_KEY = 'deepCatchRig_v2';
  const RUN_SECONDS = 40;
  const SURFACE_Y = 145;
  const EDGE = 28;

  const upgrades = [
    { key:'reel', icon:'↟', name:'Faster Reel', desc:'Descend and return faster.', costs:[40,90,170,280,420] },
    { key:'hook', icon:'J', name:'Larger Hook', desc:'Wider catch area and more capacity.', costs:[35,80,150,260,400] },
    { key:'depth', icon:'⇣', name:'Deeper Water', desc:'Reach darker water and rarer fish.', costs:[50,120,220,360,540] },
    { key:'magnet', icon:'✦', name:'Treasure Magnet', desc:'Pull nearby treasure toward the hook.', costs:[70,150,280,450,700] },
    { key:'value', icon:'¢', name:'Bonus Fish Value', desc:'Increase every fish payout.', costs:[60,130,240,390,600] }
  ];

  const fishTypes = [
    { name:'Sprat', min:0, max:.42, value:4, speed:[30,52], size:11, color:'#b8e2d8', weight:38 },
    { name:'Mackerel', min:.08, max:.66, value:8, speed:[35,60], size:15, color:'#74b9c3', weight:28 },
    { name:'Salmon', min:.28, max:.84, value:14, speed:[40,68], size:19, color:'#ea987e', weight:17 },
    { name:'Angler', min:.56, max:1, value:24, speed:[25,44], size:20, color:'#a49ad7', weight:9, angler:true },
    { name:'Golden Fish', min:.72, max:1, value:42, speed:[47,75], size:17, color:'#f4cb64', weight:3 }
  ];

  let save = loadSave();
  let W = 1, H = 1, DPR = 1;
  let state = 'menu';
  let last = performance.now();
  let gameTime = RUN_SECONDS;
  let runScore = 0;
  let sessionScore = 0;
  let tripCount = 0;
  let sessionFishCount = 0;
  let deepest = 0;
  let fishCount = 0;
  let cameraY = 0;
  let entities = [];
  let particles = [];
  let floaters = [];
  let caughtCounts = {};
  let dragActive = false;
  let soundOn = true;
  let audioCtx = null;
  let toastTimer = 0;
  const keys = { left:false, right:false };

  const hook = { x:0, y:SURFACE_Y + 35, dir:1, pause:.5, caught:[], tilt:0 };

  function defaultSave() {
    return { bank:0, upgrades:{ reel:0, hook:0, depth:0, magnet:0, value:0 } };
  }

  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      const fresh = defaultSave();
      fresh.bank = Number.isFinite(raw.bank) && raw.bank >= 0 ? Math.floor(raw.bank) : 0;
      for (const key of Object.keys(fresh.upgrades)) {
        const value = Number(raw.upgrades?.[key]);
        fresh.upgrades[key] = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
      }
      return fresh;
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
  }

  function resize() {
    const rect = app.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width || visualViewport?.width || innerWidth));
    H = Math.max(1, Math.round(rect.height || visualViewport?.height || innerHeight));
    DPR = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    hook.x = clamp(hook.x || W / 2, EDGE, W - EDGE);
  }

  function maxHookY() { return 760 + save.upgrades.depth * 270; }
  function minHookY() { return SURFACE_Y + 35; }
  function depthRange() { return Math.max(1, maxHookY() - minHookY()); }
  function maxDepthFeet() { return 70 + save.upgrades.depth * 35; }
  function reelSpeed() { return 150 + save.upgrades.reel * 30; }
  function steerSpeed() { return Math.max(190, W * .42); }
  function hookRadius() { return 17 + save.upgrades.hook * 4.5; }
  function hookCapacity() { return 1 + Math.floor((save.upgrades.hook + 1) / 2); }
  function fishMultiplier() { return 1 + save.upgrades.value * .18; }
  function magnetRadius() { return save.upgrades.magnet ? 55 + save.upgrades.magnet * 42 : 0; }
  function rigLevel() { return Object.values(save.upgrades).reduce((sum, level) => sum + level, 0); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function renderUpgrades() {
    upgradeList.textContent = '';
    for (const def of upgrades) {
      const level = save.upgrades[def.key];
      const maxed = level >= def.costs.length;
      const cost = maxed ? 0 : def.costs[level];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade';
      button.disabled = maxed || save.bank < cost;

      const icon = document.createElement('span');
      icon.className = 'upgrade-icon';
      icon.textContent = def.icon;

      const info = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'upgrade-name';
      name.textContent = def.name;
      const desc = document.createElement('span');
      desc.className = 'upgrade-desc';
      desc.textContent = def.desc;
      const dots = document.createElement('span');
      dots.className = 'level';
      def.costs.forEach((_, index) => {
        const dot = document.createElement('i');
        if (index < level) dot.className = 'on';
        dots.appendChild(dot);
      });
      info.append(name, desc, dots);

      const price = document.createElement('span');
      price.className = `cost${maxed ? ' max' : ''}`;
      price.textContent = maxed ? 'MAX' : `${cost} ¢`;
      button.append(icon, info, price);
      button.addEventListener('click', () => buyUpgrade(def));
      upgradeList.appendChild(button);
    }
    bankValue.textContent = `${save.bank.toLocaleString()} ¢`;
    rigValue.textContent = `${rigLevel()} / 25`;
    menuDepthValue.textContent = `${maxDepthFeet()} ft`;
    sessionValue.textContent = `${sessionScore.toLocaleString()} ¢`;
    doneBtn.hidden = tripCount === 0;
  }

  function buyUpgrade(def) {
    const level = save.upgrades[def.key];
    if (level >= def.costs.length) return;
    const cost = def.costs[level];
    if (save.bank < cost) return;
    save.bank -= cost;
    save.upgrades[def.key] += 1;
    persist();
    renderUpgrades();
    tone(510, .05, 'triangle', .035);
    showToast(`${def.name} upgraded`);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function resetInput() {
    setDirection('left', false);
    setDirection('right', false);
    dragActive = false;
  }

  function startRun() {
    ensureAudio();
    resetInput();
    state = 'playing';
    document.body.classList.add('deep-catch-running');
    gameTime = RUN_SECONDS;
    runScore = 0;
    deepest = 0;
    fishCount = 0;
    cameraY = 0;
    entities = [];
    particles = [];
    floaters = [];
    caughtCounts = {};
    hook.x = W / 2;
    hook.y = minHookY();
    hook.dir = 1;
    hook.pause = .65;
    hook.caught = [];
    hook.tilt = 0;
    populateWater();
    menuScreen.hidden = true;
    summaryScreen.hidden = true;
    finalScreen.hidden = true;
    hud.hidden = false;
    touchControls.hidden = false;
    updateHud();
    tone(260, .08, 'sine', .04);
  }

  function finishRun() {
    if (state !== 'playing') return;
    state = 'summary';
    if (hook.caught.length) bankCatch();
    save.bank += runScore;
    sessionScore += runScore;
    tripCount += 1;
    sessionFishCount += fishCount;
    persist();
    resetInput();
    document.body.classList.remove('deep-catch-running');
    hud.hidden = true;
    touchControls.hidden = true;

    document.querySelector('#runValue').textContent = `${runScore.toLocaleString()} ¢`;
    document.querySelector('#fishValue').textContent = String(fishCount);
    document.querySelector('#deepestValue').textContent = `${Math.round(deepest / depthRange() * maxDepthFeet())} ft`;
    document.querySelector('#summaryTitle').textContent = runScore >= 160 ? 'A legendary haul.' : runScore >= 80 ? 'A strong catch.' : runScore > 0 ? 'Not bad.' : 'The sea won this one.';
    document.querySelector('#summaryText').textContent = `${runScore.toLocaleString()} coins were added to your upgrade bank. Fishing score: ${sessionScore.toLocaleString()}.`;

    const holder = document.querySelector('#summaryCatch');
    holder.textContent = '';
    const catches = Object.entries(caughtCounts).sort((a, b) => b[1] - a[1]);
    if (!catches.length) addCatchChip(holder, 'No catch landed');
    catches.forEach(([name, count]) => addCatchChip(holder, `${name} ×${count}`));
    summaryScreen.hidden = false;
    tone(392, .12, 'triangle', .035);
    setTimeout(() => tone(523, .18, 'triangle', .03), 120);
  }

  function addCatchChip(holder, text) {
    const chip = document.createElement('span');
    chip.className = 'catch-chip';
    chip.textContent = text;
    holder.appendChild(chip);
  }

  function returnToMenu() {
    state = 'menu';
    resetInput();
    document.body.classList.remove('deep-catch-running');
    summaryScreen.hidden = true;
    finalScreen.hidden = true;
    menuScreen.hidden = false;
    renderUpgrades();
  }

  function finishSession() {
    if (tripCount === 0 || !['menu', 'summary'].includes(state)) return;
    state = 'game-over';
    resetInput();
    document.body.classList.remove('deep-catch-running');
    menuScreen.hidden = true;
    summaryScreen.hidden = true;
    finalScreen.hidden = false;
    document.querySelector('#finalScoreValue').textContent = `${sessionScore.toLocaleString()} ¢`;
    document.querySelector('#finalTripsValue').textContent = String(tripCount);
    document.querySelector('#finalFishValue').textContent = String(sessionFishCount);
    document.querySelector('#finalText').textContent = `You finished ${tripCount} ${tripCount === 1 ? 'trip' : 'trips'} with ${sessionScore.toLocaleString()} coins of catch. That score is now locked for this session.`;
    window.DeepCatchSubmitScore?.(sessionScore, tripCount);
  }

  function resetSession({ start = false } = {}) {
    sessionScore = 0;
    tripCount = 0;
    sessionFishCount = 0;
    resetInput();
    state = 'menu';
    document.body.classList.remove('deep-catch-running');
    finalScreen.hidden = true;
    summaryScreen.hidden = true;
    menuScreen.hidden = false;
    renderUpgrades();
    if (start) startRun();
  }

  function weightedFish(depthNormal) {
    const pool = fishTypes.filter(type => depthNormal >= type.min && depthNormal <= type.max);
    const total = pool.reduce((sum, type) => sum + type.weight, 0);
    let roll = Math.random() * total;
    for (const type of pool) {
      roll -= type.weight;
      if (roll <= 0) return type;
    }
    return pool[0] || fishTypes[0];
  }

  function spawnFish(depthNormal = Math.random()) {
    const kind = weightedFish(depthNormal);
    const direction = Math.random() < .5 ? -1 : 1;
    entities.push({
      type:'fish', kind,
      x:rand(40, Math.max(41, W - 40)),
      y:minHookY() + 55 + depthNormal * Math.max(1, depthRange() - 105),
      vx:direction * rand(kind.speed[0], kind.speed[1]),
      phase:Math.random() * Math.PI * 2,
      size:kind.size,
      caught:false
    });
  }

  function spawnJunk() {
    const types = [
      { name:'Old Boot', value:-5, shape:'boot' },
      { name:'Tin Can', value:-4, shape:'can' },
      { name:'Seaweed', value:-3, shape:'weed' }
    ];
    entities.push({
      type:'junk', kind:types[(Math.random() * types.length) | 0],
      x:rand(40, Math.max(41, W - 40)),
      y:rand(minHookY() + 90, Math.max(minHookY() + 91, maxHookY() - 35)),
      vx:rand(-8, 8), phase:Math.random() * 6.28, size:15, caught:false
    });
  }

  function spawnTreasure() {
    const minY = minHookY() + depthRange() * .42;
    entities.push({
      type:'treasure', kind:{ name:'Treasure', value:34 + save.upgrades.depth * 5 },
      x:rand(45, Math.max(46, W - 45)),
      y:rand(minY, Math.max(minY + 1, maxHookY() - 55)),
      vx:0, phase:Math.random() * 6.28, size:18, caught:false
    });
  }

  function populateWater() {
    const targetFish = 18 + Math.floor(depthRange() / 95);
    for (let i = 0; i < targetFish; i += 1) spawnFish(Math.random());
    for (let i = 0; i < 7 + Math.floor(save.upgrades.depth * 1.5); i += 1) spawnJunk();
    for (let i = 0; i < 2 + Math.floor(save.upgrades.depth * .55); i += 1) spawnTreasure();
  }

  function repopulate() {
    const targetFish = 18 + Math.floor(depthRange() / 95);
    let activeFish = entities.filter(entity => !entity.caught && entity.type === 'fish').length;
    while (activeFish < targetFish) { spawnFish(Math.random()); activeFish += 1; }
    if (entities.filter(entity => !entity.caught && entity.type === 'treasure').length < 2) spawnTreasure();
    if (entities.length > 150) entities = entities.filter(entity => !entity.caught);
  }

  function update(dt) {
    if (state !== 'playing') return;
    gameTime -= dt;
    if (gameTime <= 0) {
      gameTime = 0;
      updateHud();
      finishRun();
      return;
    }

    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    hook.x = clamp(hook.x + steer * steerSpeed() * dt, EDGE, W - EDGE);
    hook.tilt += (steer * .18 - hook.tilt) * Math.min(1, dt * 8);

    if (hook.pause > 0) hook.pause -= dt;
    else {
      hook.y += hook.dir * reelSpeed() * dt;
      if (hook.dir > 0 && hook.y >= maxHookY()) {
        hook.y = maxHookY();
        hook.dir = -1;
        hook.pause = .12;
        tone(150, .04, 'sine', .025);
      }
      if (hook.dir < 0 && hook.y <= minHookY()) {
        hook.y = minHookY();
        bankCatch();
        hook.dir = 1;
        hook.pause = .4;
        repopulate();
      }
    }

    deepest = Math.max(deepest, hook.y - minHookY());
    const targetCamera = Math.max(0, hook.y - H * .54);
    cameraY += (targetCamera - cameraY) * Math.min(1, dt * 3.3);

    for (const entity of entities) {
      if (entity.caught) continue;
      entity.phase += dt * 2.1;
      entity.x += entity.vx * dt;
      if (entity.type === 'fish') {
        if (entity.x < -45) entity.x = W + 45;
        if (entity.x > W + 45) entity.x = -45;
      } else if (entity.x < 25 || entity.x > W - 25) entity.vx *= -1;

      if (entity.type === 'treasure' && save.upgrades.magnet > 0) {
        const dx = hook.x - entity.x;
        const dy = hook.y - entity.y;
        const distance = Math.hypot(dx, dy);
        const radius = magnetRadius();
        if (distance < radius && distance > 2) {
          const pull = (1 - distance / radius) * (52 + save.upgrades.magnet * 18);
          entity.x += dx / distance * pull * dt;
          entity.y += dy / distance * pull * dt;
        }
      }
    }

    checkCatch();
    particles = particles.filter(p => (p.life -= dt) > 0);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 10 * dt; });
    floaters = floaters.filter(f => (f.life -= dt) > 0);
    floaters.forEach(f => { f.y -= 26 * dt; });
    updateHud();
  }

  function checkCatch() {
    if (hook.caught.length >= hookCapacity() || hook.pause > .3) return;
    const radius = hookRadius();
    let nearest = null;
    let nearestDistance = Infinity;
    for (const entity of entities) {
      if (entity.caught) continue;
      const distance = Math.hypot(entity.x - hook.x, entity.y - hook.y);
      if (distance < radius + entity.size * .65 && distance < nearestDistance) {
        nearest = entity;
        nearestDistance = distance;
      }
    }
    if (!nearest) return;
    nearest.caught = true;
    hook.caught.push(nearest);
    if (hook.caught.length >= hookCapacity()) hook.dir = -1;
    burst(nearest.x, nearest.y, nearest.type === 'treasure' ? 'gold' : 'bubble');
    const bad = nearest.type === 'junk';
    tone(bad ? 120 : nearest.type === 'treasure' ? 720 : 430, bad ? .08 : .045, bad ? 'sawtooth' : 'sine', .03);
    floaters.push({ x:nearest.x, y:nearest.y, text:bad ? 'JUNK!' : nearest.type === 'treasure' ? 'TREASURE!' : 'CAUGHT!', life:.7, bad });
  }

  function bankCatch() {
    if (!hook.caught.length) return;
    let haul = 0;
    for (const entity of hook.caught) {
      let value = entity.kind.value;
      if (entity.type === 'fish') {
        value = Math.round(value * fishMultiplier());
        fishCount += 1;
      }
      haul += value;
      caughtCounts[entity.kind.name] = (caughtCounts[entity.kind.name] || 0) + 1;
    }
    runScore = Math.max(0, runScore + haul);
    floaters.push({ x:hook.x, y:SURFACE_Y + 58, text:`${haul >= 0 ? '+' : ''}${haul} ¢`, life:1, bad:haul < 0 });
    burst(hook.x, SURFACE_Y + 50, haul >= 0 ? 'gold' : 'bubble');
    hook.caught = [];
    tone(haul >= 0 ? 560 : 130, .07, haul >= 0 ? 'triangle' : 'sawtooth', .035);
  }

  function burst(x, y, kind) {
    for (let i = 0; i < 8; i += 1) particles.push({ x, y, vx:rand(-45,45), vy:rand(-65,-15), life:rand(.35,.7), max:.7, r:rand(1,3), kind });
  }

  function updateHud() {
    const seconds = Math.ceil(gameTime);
    timeValue.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    scoreValue.textContent = runScore.toLocaleString();
    const feet = Math.round(clamp((hook.y - minHookY()) / depthRange(), 0, 1) * maxDepthFeet());
    depthValue.textContent = `${feet} ft`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawWater();
    entities.forEach(entity => { if (!entity.caught) drawEntity(entity); });
    drawLineAndHook();
    particles.forEach(drawParticle);
    floaters.forEach(drawFloater);
    drawBoat();
  }

  function drawWater() {
    const surface = SURFACE_Y - cameraY;
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, surface));
    sky.addColorStop(0, '#142934');
    sky.addColorStop(1, '#244b55');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.max(0, surface));

    const darkness = Math.min(1, cameraY / maxHookY());
    const water = ctx.createLinearGradient(0, Math.max(0, surface), 0, H);
    water.addColorStop(0, darkness < .55 ? '#174b5a' : '#0b2836');
    water.addColorStop(.55, darkness < .75 ? '#0b3343' : '#071723');
    water.addColorStop(1, darkness < .9 ? '#071f2e' : '#02080e');
    ctx.fillStyle = water;
    ctx.fillRect(0, Math.max(0, surface), W, H - Math.max(0, surface));

    ctx.save();
    ctx.globalAlpha = .1;
    ctx.strokeStyle = '#b5e7e7';
    for (let y = 70; y < H; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    if (surface > -25 && surface < H + 25) {
      ctx.strokeStyle = 'rgba(176,231,225,.48)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const y = surface + Math.sin(x * .035 + performance.now() * .002) * 3;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.font = '800 10px system-ui';
    ctx.textAlign = 'right';
    const pxPerFoot = depthRange() / maxDepthFeet();
    for (let feet = 20; feet <= maxDepthFeet(); feet += 20) {
      const y = minHookY() + feet * pxPerFoot - cameraY;
      if (y < 65 || y > H - 15) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.setLineDash([4,8]);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(190,216,218,.42)';
      ctx.fillText(`${feet} ft`, W - 12, y - 5);
    }
    ctx.restore();
  }

  function drawEntity(entity) {
    const y = entity.y - cameraY;
    if (y < -60 || y > H + 60) return;
    ctx.save();
    ctx.translate(entity.x, y + Math.sin(entity.phase) * 2.5);
    if (entity.type === 'fish') drawFish(entity.kind, entity.size, entity.vx < 0 ? -1 : 1);
    else if (entity.type === 'treasure') drawTreasure();
    else drawJunk(entity);
    ctx.restore();
  }

  function drawFish(kind, size, flip = 1) {
    ctx.save();
    ctx.scale(flip, 1);
    ctx.fillStyle = kind.color;
    ctx.globalAlpha = .24;
    ctx.beginPath(); ctx.ellipse(0,3,size*1.6,size*.75,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(0,0,size*1.25,size*.58,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-size*1.05,0); ctx.lineTo(-size*1.75,-size*.75); ctx.lineTo(-size*1.62,size*.7); ctx.closePath(); ctx.fill();
    if (kind.angler) {
      ctx.strokeStyle = kind.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(size*.4,-size*.35); ctx.quadraticCurveTo(size*.7,-size*1.2,size*1.05,-size*.9); ctx.stroke();
      ctx.fillStyle = '#f5df85'; ctx.beginPath(); ctx.arc(size*1.06,-size*.9,2.4,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#10232a'; ctx.beginPath(); ctx.arc(size*.55,-size*.12,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawTreasure() {
    ctx.shadowColor = 'rgba(241,199,91,.5)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#6e4b2b';
    ctx.fillRect(-18,-7,36,22);
    ctx.fillStyle = '#9b6b36';
    ctx.beginPath(); ctx.arc(0,-7,18,Math.PI,0); ctx.lineTo(18,0); ctx.lineTo(-18,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eac55e'; ctx.fillRect(-2,-9,4,22);
    ctx.shadowBlur = 0;
  }

  function drawJunk(entity) {
    const shape = entity.kind.shape;
    if (shape === 'can') {
      ctx.fillStyle = '#87969a'; ctx.fillRect(-8,-14,16,28);
      ctx.strokeStyle = '#52636a'; ctx.strokeRect(-8,-14,16,28);
    } else if (shape === 'boot') {
      ctx.fillStyle = '#6c6257';
      ctx.beginPath(); ctx.moveTo(-7,-15); ctx.lineTo(3,-15); ctx.lineTo(3,4); ctx.quadraticCurveTo(14,4,15,12); ctx.lineTo(-10,12); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = '#507c63'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0,14); ctx.quadraticCurveTo(-15,-3,-5,-14); ctx.moveTo(0,14); ctx.quadraticCurveTo(15,-2,7,-14); ctx.stroke();
    }
  }

  function drawLineAndHook() {
    const hookY = hook.y - cameraY;
    const boatY = SURFACE_Y - cameraY + 3;
    ctx.strokeStyle = 'rgba(236,226,196,.78)';
    ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(W/2, boatY); ctx.lineTo(hook.x, hookY); ctx.stroke();

    hook.caught.forEach((entity, index) => {
      ctx.save();
      ctx.translate(hook.x + (index % 2 ? 1 : -1) * (11 + index * 4), hookY + 17 + index * 13);
      ctx.globalAlpha = .9;
      if (entity.type === 'fish') drawFish(entity.kind, entity.size * .72, entity.vx < 0 ? -1 : 1);
      else if (entity.type === 'treasure') { ctx.scale(.72,.72); drawTreasure(); }
      else { ctx.scale(.72,.72); drawJunk(entity); }
      ctx.restore();
    });

    ctx.save();
    ctx.translate(hook.x, hookY);
    ctx.rotate(hook.tilt);
    const radius = hookRadius();
    ctx.strokeStyle = '#e4d6b4'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(0,8); ctx.quadraticCurveTo(0,radius*.85,radius*.62,radius*.42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(radius*.62,radius*.42); ctx.lineTo(radius*.28,radius*.36); ctx.stroke();
    ctx.fillStyle = '#f0c864'; ctx.beginPath(); ctx.arc(0,-12,3.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawBoat() {
    const y = SURFACE_Y - cameraY - 14;
    if (y < -80 || y > H + 60) return;
    ctx.save(); ctx.translate(W/2,y);
    ctx.fillStyle = '#603f2c'; ctx.fillRect(-54,0,108,20);
    ctx.fillStyle = '#c89152'; ctx.beginPath(); ctx.moveTo(-65,8); ctx.lineTo(65,8); ctx.lineTo(47,30); ctx.lineTo(-46,30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#233946'; ctx.fillRect(-8,-31,16,31);
    ctx.fillStyle = '#e4c16d'; ctx.beginPath(); ctx.moveTo(8,-29); ctx.lineTo(42,-14); ctx.lineTo(8,-2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawParticle(particle) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.kind === 'gold' ? '#f0ca67' : 'rgba(183,230,226,.75)';
    ctx.beginPath(); ctx.arc(particle.x, particle.y - cameraY, particle.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawFloater(floater) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, floater.life * 2);
    ctx.textAlign = 'center';
    ctx.font = '900 12px system-ui';
    ctx.fillStyle = floater.bad ? '#ef887c' : '#f2cb68';
    ctx.fillText(floater.text, floater.x, floater.y - cameraY);
    ctx.restore();
  }

  function ensureAudio() {
    if (!soundOn) return false;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) { soundOn = false; return false; }
    try {
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === 'suspended') audioCtx.resume()?.catch?.(() => {});
      return true;
    } catch {
      soundOn = false;
      return false;
    }
  }

  function tone(frequency, duration, type = 'sine', volume = .025) {
    if (!soundOn) return;
    try {
      if (!ensureAudio() || !audioCtx) return;
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioCtx.destination);
      oscillator.start(); oscillator.stop(audioCtx.currentTime + duration);
    } catch {}
  }

  function setDirection(direction, active) {
    keys[direction] = Boolean(active);
    (direction === 'left' ? leftBtn : rightBtn).classList.toggle('is-held', Boolean(active));
  }

  function bindHold(button, direction) {
    button.addEventListener('pointerdown', event => {
      if (state !== 'playing') return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setDirection(direction, true);
    });
    const release = () => setDirection(direction, false);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target?.isContentEditable) return;
    if (state === 'playing' && ['ArrowLeft','a','A'].includes(event.key)) { event.preventDefault(); setDirection('left', true); }
    if (state === 'playing' && ['ArrowRight','d','D'].includes(event.key)) { event.preventDefault(); setDirection('right', true); }
    if (state === 'menu' && !event.target.closest?.('button,input') && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); startRun(); }
  });

  addEventListener('keyup', event => {
    if (['ArrowLeft','a','A'].includes(event.key)) setDirection('left', false);
    if (['ArrowRight','d','D'].includes(event.key)) setDirection('right', false);
  });
  addEventListener('blur', resetInput);
  addEventListener('resize', resize, { passive:true });
  addEventListener('orientationchange', () => setTimeout(resize, 120), { passive:true });
  visualViewport?.addEventListener('resize', resize, { passive:true });

  bindHold(leftBtn, 'left');
  bindHold(rightBtn, 'right');

  canvas.addEventListener('pointerdown', event => {
    if (state !== 'playing') return;
    dragActive = true;
    canvas.setPointerCapture?.(event.pointerId);
    hook.x = clamp(event.clientX, EDGE, W - EDGE);
  });
  canvas.addEventListener('pointermove', event => {
    if (state === 'playing' && dragActive) hook.x = clamp(event.clientX, EDGE, W - EDGE);
  });
  canvas.addEventListener('pointerup', () => { dragActive = false; });
  canvas.addEventListener('pointercancel', () => { dragActive = false; });
  canvas.addEventListener('lostpointercapture', () => { dragActive = false; });

  document.querySelector('#playBtn').addEventListener('click', startRun);
  document.querySelector('#returnBtn').addEventListener('click', returnToMenu);
  document.querySelector('#doneBtn').addEventListener('click', finishSession);
  document.querySelector('#summaryDoneBtn').addEventListener('click', finishSession);
  document.querySelector('#newSessionBtn').addEventListener('click', () => resetSession());
  document.querySelector('#menuScoresBtn').addEventListener('click', () => window.EscapeeScores?.show());
  document.querySelector('#summaryScoresBtn').addEventListener('click', () => window.EscapeeScores?.show());
  document.querySelector('#finalScoresBtn').addEventListener('click', () => window.EscapeeScores?.show());
  soundBtn.addEventListener('click', () => { soundOn = !soundOn; if (soundOn) tone(520, .05); });

  window.EscapeeGame = {
    pause() {
      if (state === 'playing') {
        state = 'paused';
        resetInput();
      }
    },
    resume() {
      if (state === 'paused') state = 'playing';
    },
    restart() {
      if (state === 'game-over') resetSession({ start:true });
      else startRun();
    },
    getStatus() {
      if (state === 'summary') return 'between-rounds';
      if (state === 'game-over') return 'game-over';
      return state;
    }
  };

  function loop(now) {
    const dt = Math.max(0, Math.min(.034, (now - last) / 1000 || 0));
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  for (let i = 0; i < 16; i += 1) spawnFish(Math.random());
  renderUpgrades();
  requestAnimationFrame(loop);
})();