(() => {
  'use strict';

  const app = document.getElementById('app');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const controls = document.getElementById('touchControls');
  const menuScreen = document.getElementById('menuScreen');
  const summaryScreen = document.getElementById('summaryScreen');
  const finalScreen = document.getElementById('finalScreen');
  const upgradeList = document.getElementById('upgradeList');
  const timeValue = document.getElementById('timeValue');
  const scoreValue = document.getElementById('scoreValue');
  const depthValue = document.getElementById('depthValue');
  const bankValue = document.getElementById('bankValue');
  const rigValue = document.getElementById('rigValue');
  const menuDepthValue = document.getElementById('menuDepthValue');
  const sessionValue = document.getElementById('sessionValue');
  const doneBtn = document.getElementById('doneBtn');
  const toast = document.getElementById('toast');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const soundBtn = document.getElementById('soundBtn');

  const SAVE_KEY = 'deepCatchRig_v2';
  const LEGACY_SAVE_KEY = 'deepCatchSave_v1';
  const RUN_SECONDS = 40;
  const SURFACE_Y = 150;
  const WORLD_MARGIN = 28;

  const upgradeDefs = [
    { key:'reel', icon:'↟', name:'Faster Reel', desc:'The hook descends and returns faster.', costs:[40, 90, 170, 280, 420] },
    { key:'hook', icon:'J', name:'Larger Hook', desc:'Wider catch area and more carrying capacity.', costs:[35, 80, 150, 260, 400] },
    { key:'depth', icon:'⇣', name:'Deeper Water', desc:'Reach darker zones with rarer fish.', costs:[50, 120, 220, 360, 540] },
    { key:'magnet', icon:'✦', name:'Treasure Magnet', desc:'Pull nearby treasure toward the hook.', costs:[70, 150, 280, 450, 700] },
    { key:'value', icon:'¢', name:'Bonus Fish Value', desc:'Every fish is worth more at the dock.', costs:[60, 130, 240, 390, 600] }
  ];

  const creatures = [
    { id:'sprat', name:'Sprat', emoji:'', min:0, max:.42, value:4, speed:[28,48], size:11, hue:'#b8e2d8', weight:38 },
    { id:'mackerel', name:'Mackerel', emoji:'', min:.10, max:.64, value:8, speed:[34,58], size:15, hue:'#74b9c3', weight:28 },
    { id:'salmon', name:'Salmon', emoji:'', min:.30, max:.82, value:14, speed:[38,65], size:19, hue:'#ea987e', weight:17 },
    { id:'angler', name:'Angler', emoji:'', min:.58, max:1, value:24, speed:[24,42], size:20, hue:'#a49ad7', weight:9 },
    { id:'gold', name:'Golden Fish', emoji:'', min:.72, max:1, value:42, speed:[45,72], size:17, hue:'#f4cb64', weight:3 }
  ];

  let save = loadSave();
  let W = innerWidth, H = innerHeight, DPR = 1;
  let state = 'menu';
  let last = performance.now();
  let gameTime = RUN_SECONDS;
  let runScore = 0;
  let sessionScore = 0;
  let tripCount = 0;
  let sessionFishCount = 0;
  let deepest = 0;
  let cameraY = 0;
  let entities = [];
  let particles = [];
  let floaters = [];
  let caughtCounts = {};
  let catchTotal = 0;
  let fishCount = 0;
  let soundOn = true;
  let audioCtx = null;
  let toastTimer = null;
  let dragActive = false;
  const keys = { left:false, right:false };

  const hook = {
    x: 0, y: SURFACE_Y + 40, dir: 1, pause: .45,
    caught: [], tilt: 0
  };

  function loadSave() {
    try {
      let raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw) raw = JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) || '{}');
      const cleanLevel = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(5, Math.floor(Number(value)))) : 0;
      return {
        bank: Number.isFinite(Number(raw.bank)) ? Math.max(0, Math.floor(Number(raw.bank))) : 0,
        upgrades: {
          reel: cleanLevel(raw.upgrades?.reel),
          hook: cleanLevel(raw.upgrades?.hook),
          depth: cleanLevel(raw.upgrades?.depth),
          magnet: cleanLevel(raw.upgrades?.magnet),
          value: cleanLevel(raw.upgrades?.value)
        }
      };
    } catch {
      return { bank:0, upgrades:{reel:0,hook:0,depth:0,magnet:0,value:0} };
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
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    hook.x = Math.max(WORLD_MARGIN, Math.min(W - WORLD_MARGIN, hook.x || W/2));
  }
  addEventListener('resize', resize, { passive:true });
  addEventListener('orientationchange', () => setTimeout(resize, 120), { passive:true });
  visualViewport?.addEventListener('resize', resize, { passive:true });
  resize();

  function maxDepthWorld() { return 760 + save.upgrades.depth * 270; }
  function minHookWorld() { return SURFACE_Y + 35; }
  function depthRangeWorld() { return Math.max(1, maxDepthWorld() - minHookWorld()); }
  function maxDepthFeet() { return 70 + save.upgrades.depth * 35; }
  function reelSpeed() { return 150 + save.upgrades.reel * 30; }
  function moveSpeed() { return Math.max(190, W * .42); }
  function hookRadius() { return 17 + save.upgrades.hook * 4.5; }
  function hookCapacity() { return 1 + Math.floor((save.upgrades.hook + 1) / 2); }
  function fishMultiplier() { return 1 + save.upgrades.value * .18; }
  function magnetRadius() { return save.upgrades.magnet ? 55 + save.upgrades.magnet * 42 : 0; }

  function buildUpgrades() {
    upgradeList.textContent = '';
    for (const def of upgradeDefs) {
      const lvl = save.upgrades[def.key];
      const maxed = lvl >= def.costs.length;
      const cost = maxed ? null : def.costs[lvl];
      const btn = document.createElement('button');
      btn.className = 'upgrade';
      btn.disabled = maxed || save.bank < cost;
      btn.innerHTML = `
        <span class="upgrade-icon">${def.icon}</span>
        <span>
          <span class="upgrade-name">${def.name}</span>
          <span class="upgrade-desc">${def.desc}</span>
          <span class="level">${def.costs.map((_,i)=>`<i class="${i<lvl?'on':''}"></i>`).join('')}</span>
        </span>
        <span class="cost ${maxed?'max':''}">${maxed?'MAX':cost+' ¢'}</span>`;
      btn.addEventListener('click', () => buyUpgrade(def));
      upgradeList.appendChild(btn);
    }
    bankValue.textContent = save.bank.toLocaleString() + ' ¢';
    rigValue.textContent = Object.values(save.upgrades).reduce((sum, level) => sum + level, 0) + ' / 25';
    menuDepthValue.textContent = maxDepthFeet() + ' ft';
    sessionValue.textContent = sessionScore.toLocaleString() + ' ¢';
    doneBtn.hidden = tripCount === 0;
  }

  function buyUpgrade(def) {
    const lvl = save.upgrades[def.key];
    if (lvl >= def.costs.length) return;
    const cost = def.costs[lvl];
    if (save.bank < cost) return;
    save.bank -= cost;
    save.upgrades[def.key]++;
    persist();
    tone(510, .05, 'triangle', .035);
    showToast(`${def.name} upgraded`);
    buildUpgrades();
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function startRun() {
    ensureAudio();
    setDirection('left', false);
    setDirection('right', false);
    dragActive = false;
    state = 'playing';
    document.body.classList.add('deep-catch-running');
    gameTime = RUN_SECONDS;
    runScore = 0; catchTotal = 0; fishCount = 0; deepest = 0;
    cameraY = 0; entities = []; particles = []; floaters = []; caughtCounts = {};
    hook.x = W/2; hook.y = SURFACE_Y + 36; hook.dir = 1; hook.pause = .65; hook.caught = [];
    populateWater();
    menuScreen.hidden = true;
    summaryScreen.hidden = true;
    finalScreen.hidden = true;
    hud.hidden = false; controls.hidden = false;
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
    document.body.classList.remove('deep-catch-running');
    hud.hidden = true; controls.hidden = true;
    document.getElementById('runValue').textContent = runScore.toLocaleString() + ' ¢';
    document.getElementById('fishValue').textContent = fishCount;
    document.getElementById('deepestValue').textContent = Math.round(deepest / depthRangeWorld() * maxDepthFeet()) + ' ft';
    document.getElementById('summaryTitle').textContent = runScore >= 160 ? 'A legendary haul.' : runScore >= 80 ? 'A strong catch.' : runScore > 0 ? 'Not bad.' : 'The sea won this one.';
    document.getElementById('summaryText').textContent = `${runScore.toLocaleString()} coins went to the upgrade bank. Your fishing score is now ${sessionScore.toLocaleString()}.`;
    const holder = document.getElementById('summaryCatch');
    holder.textContent = '';
    const ordered = Object.entries(caughtCounts).sort((a,b)=>b[1]-a[1]);
    if (!ordered.length) holder.innerHTML = '<span class="catchChip">No catch landed</span>';
    for (const [name,count] of ordered) {
      const chip = document.createElement('span'); chip.className='catchChip'; chip.textContent=`${name} ×${count}`; holder.appendChild(chip);
    }
    summaryScreen.hidden = false;
    tone(392, .12, 'triangle', .035); setTimeout(()=>tone(523, .18, 'triangle', .03), 120);
  }

  function returnToMenu() {
    state = 'menu';
    document.body.classList.remove('deep-catch-running');
    summaryScreen.hidden = true;
    finalScreen.hidden = true;
    menuScreen.hidden = false;
    buildUpgrades();
  }

  function finishSession() {
    if (tripCount === 0 || state === 'playing' || state === 'paused' || state === 'game-over') return;
    state = 'game-over';
    document.body.classList.remove('deep-catch-running');
    menuScreen.hidden = true;
    summaryScreen.hidden = true;
    finalScreen.hidden = false;
    document.getElementById('finalScoreValue').textContent = sessionScore.toLocaleString() + ' ¢';
    document.getElementById('finalTripsValue').textContent = tripCount.toLocaleString();
    document.getElementById('finalFishValue').textContent = sessionFishCount.toLocaleString();
    document.getElementById('finalText').textContent = `You finished ${tripCount} ${tripCount === 1 ? 'trip' : 'trips'} with ${sessionScore.toLocaleString()} coins of catch. That score is now locked for this session.`;
    window.EscapeeScores?.submit(sessionScore, {
      label: 'Fishing score',
      display: `${sessionScore.toLocaleString()} coins · ${tripCount} ${tripCount === 1 ? 'trip' : 'trips'}`
    });
  }

  function resetSession({ start = false } = {}) {
    sessionScore = 0;
    tripCount = 0;
    sessionFishCount = 0;
    finalScreen.hidden = true;
    summaryScreen.hidden = true;
    menuScreen.hidden = false;
    state = 'menu';
    buildUpgrades();
    if (start) startRun();
  }

  function populateWater() {
    const depth = maxDepthWorld();
    const count = Math.floor(18 + depth / 95);
    for (let i=0;i<count;i++) spawnFish(Math.random() * .94 + .04);
    const junkCount = 7 + Math.floor(save.upgrades.depth * 1.5);
    for (let i=0;i<junkCount;i++) spawnJunk();
    const treasureCount = 2 + Math.floor(save.upgrades.depth * .55);
    for (let i=0;i<treasureCount;i++) spawnTreasure();
  }

  function weightedFish(depthNorm) {
    const pool = creatures.filter(f => depthNorm >= f.min && depthNorm <= f.max);
    let total = pool.reduce((s,f)=>s+f.weight,0), roll=Math.random()*total;
    for (const f of pool) { roll -= f.weight; if (roll <= 0) return f; }
    return pool[0] || creatures[0];
  }

  function spawnFish(depthNorm = Math.random()) {
    const kind = weightedFish(depthNorm);
    const dir = Math.random() < .5 ? -1 : 1;
    entities.push({
      type:'fish', kind, x: Math.random()*(W-80)+40,
      y: minHookWorld() + 55 + depthNorm * Math.max(1, depthRangeWorld() - 105),
      vx: dir * rand(kind.speed[0], kind.speed[1]), phase:Math.random()*Math.PI*2,
      size:kind.size, caught:false
    });
  }

  function spawnJunk() {
    const junkKinds = [
      {name:'Old Boot', value:-5, shape:'boot'},
      {name:'Tin Can', value:-4, shape:'can'},
      {name:'Seaweed', value:-3, shape:'weed'}
    ];
    entities.push({ type:'junk', kind:junkKinds[(Math.random()*junkKinds.length)|0], x:rand(40,W-40), y:rand(minHookWorld()+90,maxDepthWorld()-35), vx:rand(-8,8), phase:Math.random()*6.28, size:15, caught:false });
  }

  function spawnTreasure() {
    const treasureMin = minHookWorld() + depthRangeWorld() * .42;
    entities.push({ type:'treasure', kind:{name:'Treasure',value:34 + save.upgrades.depth*5}, x:rand(45,W-45), y:rand(treasureMin,maxDepthWorld()-55), vx:0, phase:Math.random()*6.28, size:18, caught:false });
  }

  function rand(a,b) { return a + Math.random()*(b-a); }

  function update(dt) {
    if (state !== 'playing') return;
    gameTime -= dt;
    if (gameTime <= 0) { gameTime = 0; updateHud(); finishRun(); return; }

    let steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    hook.x += steer * moveSpeed() * dt;
    hook.x = Math.max(WORLD_MARGIN, Math.min(W-WORLD_MARGIN, hook.x));
    hook.tilt += ((steer*.18)-hook.tilt) * Math.min(1,dt*8);

    if (hook.pause > 0) {
      hook.pause -= dt;
    } else {
      hook.y += hook.dir * reelSpeed() * dt;
      if (hook.dir > 0 && hook.y >= maxDepthWorld()) {
        hook.y = maxDepthWorld(); hook.dir = -1; hook.pause = .12; tone(150,.04,'sine',.025);
      }
      if (hook.dir < 0 && hook.y <= minHookWorld()) {
        hook.y = minHookWorld();
        bankCatch();
        hook.dir = 1; hook.pause = .40;
        repopulateIfNeeded();
      }
    }

    deepest = Math.max(deepest, hook.y - minHookWorld());
    const desiredCamera = Math.max(0, hook.y - H*.54);
    cameraY += (desiredCamera-cameraY) * Math.min(1, dt*3.3);

    for (const e of entities) {
      if (e.caught) continue;
      e.phase += dt * 2.1;
      e.x += e.vx * dt;
      if (e.type === 'fish') {
        if (e.x < -45) e.x = W+45;
        if (e.x > W+45) e.x = -45;
      } else {
        if (e.x < 25 || e.x > W-25) e.vx *= -1;
      }

      if (e.type === 'treasure' && save.upgrades.magnet > 0) {
        const dx = hook.x-e.x, dy=hook.y-e.y, d=Math.hypot(dx,dy);
        if (d < magnetRadius() && d > 2) {
          const pull = (1-d/magnetRadius()) * (52 + save.upgrades.magnet*18);
          e.x += dx/d*pull*dt; e.y += dy/d*pull*dt;
          if (Math.random()<dt*8) particles.push({x:e.x,y:e.y,vx:rand(-8,8),vy:rand(-20,-5),life:.45,max:.45,r:1.5,kind:'gold'});
        }
      }
    }

    checkCatches();
    particles = particles.filter(p => (p.life-=dt) > 0);
    for (const p of particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=10*dt; }
    floaters = floaters.filter(f => (f.life-=dt)>0);
    for (const f of floaters) f.y -= 26*dt;
    updateHud();
  }

  function repopulateIfNeeded() {
    const target = 18 + Math.floor(maxDepthWorld()/95);
    while (entities.filter(e=>!e.caught && e.type==='fish').length < target) spawnFish(Math.random());
    if (entities.filter(e=>!e.caught && e.type==='treasure').length < 2) spawnTreasure();
    if (entities.length > 150) entities = entities.filter(e=>!e.caught);
  }

  function checkCatches() {
    if (hook.caught.length >= hookCapacity() || hook.pause > .3) return;
    const r = hookRadius();
    let nearest = null, nearestD = Infinity;
    for (const e of entities) {
      if (e.caught) continue;
      const d = Math.hypot(e.x-hook.x, e.y-hook.y);
      if (d < r + e.size*.65 && d < nearestD) { nearest=e; nearestD=d; }
    }
    if (!nearest) return;
    nearest.caught = true;
    hook.caught.push(nearest);
    if (hook.caught.length >= hookCapacity()) hook.dir = -1;
    burst(nearest.x, nearest.y, nearest.type==='treasure'?'gold':'bubble');
    const isBad = nearest.type==='junk';
    tone(isBad?120:(nearest.type==='treasure'?720:430), isBad?.08:.045, isBad?'sawtooth':'sine', .03);
    floaters.push({x:nearest.x,y:nearest.y,text:isBad?'JUNK!':nearest.type==='treasure'?'TREASURE!':'CAUGHT!',life:.7,bad:isBad});
  }

  function bankCatch() {
    if (!hook.caught.length) return;
    let haul = 0;
    for (const e of hook.caught) {
      let value = e.kind.value;
      if (e.type === 'fish') { value = Math.round(value * fishMultiplier()); fishCount++; }
      haul += value;
      caughtCounts[e.kind.name] = (caughtCounts[e.kind.name] || 0) + 1;
    }
    runScore = Math.max(0, runScore + haul);
    catchTotal += haul;
    floaters.push({x:hook.x,y:SURFACE_Y+58,text:(haul>=0?'+':'')+haul+' ¢',life:1,bad:haul<0});
    burst(hook.x,SURFACE_Y+50,haul>=0?'gold':'bubble');
    hook.caught = [];
    tone(haul>=0?560:130,.07,haul>=0?'triangle':'sawtooth',.035);
  }

  function burst(x,y,kind) {
    for(let i=0;i<9;i++) particles.push({x,y,vx:rand(-45,45),vy:rand(-65,-15),life:rand(.35,.75),max:.75,r:rand(1,3),kind});
  }

  function updateHud() {
    const secs = Math.ceil(gameTime), m=Math.floor(secs/60), s=String(secs%60).padStart(2,'0');
    timeValue.textContent = `${m}:${s}`;
    scoreValue.textContent = runScore.toLocaleString();
    const feet = Math.max(0, Math.round((hook.y-minHookWorld())/depthRangeWorld()*maxDepthFeet()));
    depthValue.textContent = feet+' ft';
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    drawSkyAndWater();
    drawWorld();
    if (state === 'menu') drawMenuBackdrop();
  }

  function drawSkyAndWater() {
    const surfaceScreen = SURFACE_Y-cameraY;
    const sky = ctx.createLinearGradient(0,0,0,Math.max(1,surfaceScreen));
    sky.addColorStop(0,'#142934'); sky.addColorStop(1,'#244b55');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,Math.max(0,surfaceScreen));

    const water = ctx.createLinearGradient(0,Math.max(0,surfaceScreen),0,H);
    const darkness = Math.min(1,cameraY/maxDepthWorld());
    water.addColorStop(0, mix('#174b5a','#071924',darkness*.75));
    water.addColorStop(.55, mix('#0b3343','#041019',darkness*.82));
    water.addColorStop(1, mix('#071f2e','#02080e',darkness*.9));
    ctx.fillStyle=water; ctx.fillRect(0,Math.max(0,surfaceScreen),W,H-Math.max(0,surfaceScreen));

    ctx.save();
    ctx.globalAlpha=.12;
    ctx.strokeStyle='#b5e7e7'; ctx.lineWidth=1;
    const spacing=70;
    for(let wy=Math.floor((cameraY-SURFACE_Y)/spacing)*spacing+SURFACE_Y; wy<cameraY+H; wy+=spacing){
      const sy=wy-cameraY;
      ctx.beginPath();
      for(let x=0;x<=W;x+=18){ const y=sy+Math.sin(x*.025+wy*.008+performance.now()*.00035)*2.5; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke();
    }
    ctx.restore();

    if (surfaceScreen > -30 && surfaceScreen < H+30) {
      ctx.save(); ctx.strokeStyle='rgba(176,231,225,.48)'; ctx.lineWidth=2;
      ctx.beginPath();
      for(let x=0;x<=W;x+=12){ const y=surfaceScreen+Math.sin(x*.035+performance.now()*.002)*3; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke(); ctx.restore();
    }

    drawLightRays(surfaceScreen);
    drawDepthMarkers();
  }

  function drawLightRays(surfaceScreen) {
    if (surfaceScreen < -H*.2) return;
    ctx.save();
    const g=ctx.createLinearGradient(0,Math.max(0,surfaceScreen),0,H);
    g.addColorStop(0,'rgba(153,224,217,.08)'); g.addColorStop(1,'rgba(153,224,217,0)');
    ctx.fillStyle=g;
    for(let i=0;i<4;i++){
      const x=(i+.4)*W/4;
      ctx.beginPath(); ctx.moveTo(x-18,Math.max(0,surfaceScreen)); ctx.lineTo(x-70,H); ctx.lineTo(x+90,H); ctx.lineTo(x+18,Math.max(0,surfaceScreen)); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawDepthMarkers() {
    const stepFeet=20;
    const pxPerFoot=maxDepthWorld()/maxDepthFeet();
    ctx.save(); ctx.font='800 10px system-ui'; ctx.textAlign='right';
    for(let ft=stepFeet;ft<=maxDepthFeet();ft+=stepFeet){
      const sy=SURFACE_Y+ft*pxPerFoot-cameraY;
      if(sy<70||sy>H-20) continue;
      ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.setLineDash([4,8]); ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(W,sy); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle='rgba(190,216,218,.38)'; ctx.fillText(ft+' ft',W-12,sy-6);
    }
    ctx.restore();
  }

  function drawWorld() {
    for (const e of entities) if (!e.caught) drawEntity(e);
    drawLineAndHook();
    for (const p of particles) drawParticle(p);
    for (const f of floaters) drawFloater(f);
    drawSurfaceBoat();
  }

  function drawSurfaceBoat() {
    const y=SURFACE_Y-cameraY;
    if(y < -100 || y > H+80) return;
    ctx.save(); ctx.translate(W/2,y-14);
    ctx.fillStyle='#603f2c'; roundRect(ctx,-54,0,108,22,6); ctx.fill();
    ctx.fillStyle='#c89152'; ctx.beginPath(); ctx.moveTo(-65,8); ctx.lineTo(65,8); ctx.lineTo(47,31); ctx.lineTo(-46,31); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#233946'; roundRect(ctx,-8,-31,16,33,4); ctx.fill();
    ctx.fillStyle='#e4c16d'; ctx.beginPath(); ctx.moveTo(8,-29); ctx.lineTo(42,-14); ctx.lineTo(8,-2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawLineAndHook() {
    const boatX=W/2, boatY=SURFACE_Y-cameraY+3;
    const hy=hook.y-cameraY;
    ctx.save();
    ctx.strokeStyle='rgba(236,226,196,.74)'; ctx.lineWidth=1.25;
    ctx.beginPath(); ctx.moveTo(boatX,boatY); ctx.lineTo(hook.x,hy); ctx.stroke();

    for(let i=0;i<hook.caught.length;i++){
      const e=hook.caught[i];
      const ox=(i%2?1:-1)*(11+i*4), oy=17+i*13;
      drawCaughtEntity(e,hook.x+ox,hy+oy);
    }

    ctx.translate(hook.x,hy); ctx.rotate(hook.tilt);
    const r=hookRadius();
    ctx.strokeStyle='#e4d6b4'; ctx.lineWidth=3.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(0,8); ctx.quadraticCurveTo(0,r*.85,r*.62,r*.42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*.62,r*.42); ctx.lineTo(r*.28,r*.36); ctx.stroke();
    ctx.fillStyle='#f0c864'; ctx.beginPath(); ctx.arc(0,-12,3.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawCaughtEntity(e,x,y) {
    ctx.save(); ctx.globalAlpha=.9; ctx.translate(x,y); ctx.rotate(Math.sin(performance.now()*.006+y)*.22);
    if(e.type==='fish') drawFishShape(e,0,0,.72); else if(e.type==='treasure') drawTreasureShape(0,0,.72); else drawJunkShape(e,0,0,.72);
    ctx.restore();
  }

  function drawEntity(e) {
    const sy=e.y-cameraY;
    if(sy < -60 || sy > H+60) return;
    ctx.save(); ctx.translate(e.x,sy);
    if(e.type==='fish') drawFishShape(e,0,Math.sin(e.phase)*3,1);
    else if(e.type==='treasure') drawTreasureShape(0,Math.sin(e.phase*.7)*2,1);
    else drawJunkShape(e,0,Math.sin(e.phase)*2,1);
    ctx.restore();
  }

  function drawFishShape(e,x,y,scale) {
    const s=e.size*scale, flip=e.vx<0?-1:1;
    ctx.save(); ctx.translate(x,y); ctx.scale(flip,1);
    ctx.globalAlpha=.23; ctx.fillStyle=e.kind.hue; ctx.beginPath(); ctx.ellipse(0,3,s*1.6,s*.75,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.fillStyle=e.kind.hue;
    ctx.beginPath(); ctx.ellipse(0,0,s*1.25,s*.58,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s*1.05,0); ctx.lineTo(-s*1.75,-s*.75); ctx.lineTo(-s*1.62,s*.7); ctx.closePath(); ctx.fill();
    if(e.kind.id==='angler'){
      ctx.strokeStyle=e.kind.hue; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(s*.4,-s*.35); ctx.quadraticCurveTo(s*.7,-s*1.2,s*1.05,-s*.9); ctx.stroke();
      ctx.fillStyle='#f5df85'; ctx.beginPath(); ctx.arc(s*1.06,-s*.9,2.4*scale,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#10232a'; ctx.beginPath(); ctx.arc(s*.55,-s*.12,Math.max(1.5,2.2*scale),0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawTreasureShape(x,y,scale) {
    const s=18*scale;
    ctx.save(); ctx.translate(x,y);
    ctx.shadowColor='rgba(241,199,91,.55)'; ctx.shadowBlur=12*scale;
    ctx.fillStyle='#6e4b2b'; roundRect(ctx,-s,-s*.4,s*2,s*1.25,4*scale); ctx.fill();
    ctx.fillStyle='#9b6b36'; ctx.beginPath(); ctx.arc(0,-s*.36,s,Math.PI,0); ctx.lineTo(s,s*.1); ctx.lineTo(-s,s*.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#eac55e'; ctx.fillRect(-s*.12,-s*.48,s*.24,s*1.05);
    ctx.restore();
  }

  function drawJunkShape(e,x,y,scale) {
    const s=15*scale; ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(e.phase)*.15);
    if(e.kind.shape==='boot'){
      ctx.fillStyle='#6c6257'; ctx.beginPath(); ctx.moveTo(-s*.5,-s); ctx.lineTo(s*.15,-s); ctx.lineTo(s*.15,s*.25); ctx.quadraticCurveTo(s*.9,s*.25,s,s*.8); ctx.lineTo(-s*.7,s*.8); ctx.closePath(); ctx.fill();
    } else if(e.kind.shape==='can'){
      ctx.fillStyle='#87969a'; roundRect(ctx,-s*.55,-s,s*1.1,s*2,3); ctx.fill(); ctx.strokeStyle='#52636a'; ctx.lineWidth=2; ctx.stroke();
    } else {
      ctx.strokeStyle='#507c63'; ctx.lineWidth=5*scale; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,s); ctx.quadraticCurveTo(-s,-s*.2,-s*.3,-s); ctx.moveTo(0,s); ctx.quadraticCurveTo(s,-s*.15,s*.45,-s); ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(p) {
    const sy=p.y-cameraY; ctx.save();
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.kind==='gold'?'#f0ca67':'rgba(183,230,226,.75)';
    ctx.beginPath(); ctx.arc(p.x,sy,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function drawFloater(f) {
    const sy=f.y-cameraY; ctx.save(); ctx.globalAlpha=Math.min(1,f.life*2); ctx.textAlign='center'; ctx.font='900 12px system-ui'; ctx.fillStyle=f.bad?'#ef887c':'#f2cb68'; ctx.fillText(f.text,f.x,sy); ctx.restore();
  }

  function drawMenuBackdrop() {}

  function mix(a,b,t) {
    const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
    const ar=pa>>16, ag=(pa>>8)&255, ab=pa&255, br=pb>>16, bg=(pb>>8)&255, bb=pb&255;
    const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), bl=Math.round(ab+(bb-ab)*t);
    return `rgb(${r},${g},${bl})`;
  }

  function roundRect(c,x,y,w,h,r) {
    r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }

  function ensureAudio() {
    if (!soundOn) return false;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      soundOn = false;
      soundBtn.textContent = '×';
      soundBtn.setAttribute('aria-label', 'Sound unavailable');
      return false;
    }
    try {
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === 'suspended') {
        const pending = audioCtx.resume();
        pending?.catch?.(() => {});
      }
      return true;
    } catch {
      soundOn = false;
      soundBtn.textContent = '×';
      soundBtn.setAttribute('aria-label', 'Sound unavailable');
      return false;
    }
  }

  function tone(freq,duration,type='sine',volume=.025) {
    if(!soundOn) return;
    try {
      if (!ensureAudio() || !audioCtx) return;
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type=type; o.frequency.value=freq; g.gain.setValueAtTime(volume,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+duration);
    } catch {}
  }

  function setDirection(dir, active) {
    keys[dir] = active;
    const btn=dir==='left'?leftBtn:rightBtn;
    btn.classList.toggle('is-held',active);
  }

  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target?.isContentEditable) return;
    if (state === 'playing' && ['ArrowLeft','a','A'].includes(e.key)){e.preventDefault();setDirection('left',true);}
    if (state === 'playing' && ['ArrowRight','d','D'].includes(e.key)){e.preventDefault();setDirection('right',true);}
    const scoreOverlay = document.querySelector('.escapee-score-overlay');
    const scoreOpen = scoreOverlay && !scoreOverlay.hidden;
    if((e.key===' '||e.key==='Enter') && state==='menu' && !scoreOpen && e.target === document.body){e.preventDefault();startRun();}
  });
  addEventListener('keyup', e => {
    if(['ArrowLeft','a','A'].includes(e.key))setDirection('left',false);
    if(['ArrowRight','d','D'].includes(e.key))setDirection('right',false);
  });
  addEventListener('blur',()=>{setDirection('left',false);setDirection('right',false);});

  function bindHold(btn,dir){
    btn.addEventListener('pointerdown',e=>{if(state!=='playing')return;e.preventDefault();btn.setPointerCapture?.(e.pointerId);setDirection(dir,true);});
    btn.addEventListener('pointerup',e=>{e.preventDefault();setDirection(dir,false);});
    btn.addEventListener('pointercancel',()=>setDirection(dir,false));
    btn.addEventListener('lostpointercapture',()=>setDirection(dir,false));
  }
  bindHold(leftBtn,'left'); bindHold(rightBtn,'right');

  canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;dragActive=true;canvas.setPointerCapture?.(e.pointerId);hook.x=Math.max(WORLD_MARGIN,Math.min(W-WORLD_MARGIN,e.clientX));});
  canvas.addEventListener('pointermove',e=>{ if(state==='playing'&&dragActive) hook.x=Math.max(WORLD_MARGIN,Math.min(W-WORLD_MARGIN,e.clientX)); });
  canvas.addEventListener('pointerup',()=>dragActive=false);
  canvas.addEventListener('pointercancel',()=>dragActive=false);
  canvas.addEventListener('lostpointercapture',()=>dragActive=false);

  document.getElementById('playBtn').addEventListener('click',startRun);
  document.getElementById('returnBtn').addEventListener('click',returnToMenu);
  document.getElementById('doneBtn').addEventListener('click',finishSession);
  document.getElementById('summaryDoneBtn').addEventListener('click',finishSession);
  document.getElementById('newSessionBtn').addEventListener('click',()=>resetSession());
  document.getElementById('menuScoresBtn').addEventListener('click',()=>window.EscapeeScores?.show());
  document.getElementById('summaryScoresBtn').addEventListener('click',()=>window.EscapeeScores?.show());
  document.getElementById('finalScoresBtn').addEventListener('click',()=>window.EscapeeScores?.show());
  soundBtn.addEventListener('click',()=>{soundOn=!soundOn;soundBtn.textContent=soundOn?'♪':'×'; if(soundOn)tone(520,.05);});

  window.EscapeeGame = {
    pause() {
      if (state === 'playing') {
        state = 'paused';
        setDirection('left', false);
        setDirection('right', false);
        dragActive = false;
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
      if (state === 'game-over') return 'game-over';
      return state;
    }
  };

  function loop(now) {
    const dt=Math.min(.034,(now-last)/1000||0); last=now;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  for(let i=0;i<16;i++) spawnFish(Math.random());
  buildUpgrades();
  requestAnimationFrame(loop);
})();