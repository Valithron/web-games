(() => {
  'use strict';
  const canvas = document.querySelector('#canvas');
  const ctx = canvas.getContext('2d');
  const startScreen = document.querySelector('#startScreen');
  const upgradeScreen = document.querySelector('#upgradeScreen');
  const endScreen = document.querySelector('#endScreen');
  const upgradeChoices = document.querySelector('#upgradeChoices');
  const roomNameEl = document.querySelector('#roomName');
  const roomLabelEl = document.querySelector('#roomLabel');
  const cleanMeter = document.querySelector('#cleanMeter');
  const timeValue = document.querySelector('#timeValue');
  const timeStat = document.querySelector('#timeStat');
  const scoreValue = document.querySelector('#scoreValue');
  const prompt = document.querySelector('#prompt');
  const joystick = document.querySelector('#joystick');
  const cleanBtn = document.querySelector('#cleanBtn');

  const rooms = ['Goblin Barracks','Alchemy Spillway','Royal Crypt','Ogre Kitchen','Treasure Annex','Boss Chamber Aftermath'];
  const messTypes = {
    bones: { label:'sweep bones', duration:.65, points:80, color:'#e7dfc9' },
    slime: { label:'mop slime', duration:1.35, points:130, color:'#79b75e' },
    weapon: { label:'collect weapon', duration:1.05, points:110, color:'#9da4af' },
    spill: { label:'scrub potion spill', duration:1.6, points:150, color:'#b76fd1' },
    treasure: { label:'return treasure', duration:.9, points:170, color:'#e6c158' }
  };
  const upgradePool = [
    { name:'Longer Mop', text:'Cleaning reach +18%.', apply:s => s.reach *= 1.18 },
    { name:'Quick Hands', text:'Clean messes 22% faster.', apply:s => s.cleanSpeed *= 1.22 },
    { name:'Work Boots', text:'Movement speed +15%.', apply:s => s.moveSpeed *= 1.15 },
    { name:'Early Warning', text:'Next parties arrive 8 seconds later.', apply:s => s.timeBonus += 8 },
    { name:'Hazard Pay', text:'All cleaned messes score 25% more.', apply:s => s.scoreMult *= 1.25 },
    { name:'Monster Repellent', text:'Leftover monsters move 22% slower.', apply:s => s.monsterSlow *= .78 },
    { name:'Treasure Ledger', text:'Returned treasure is worth double.', apply:s => s.treasureMult *= 2 },
    { name:'Steel-Toe Boots', text:'Monster collisions cost less time.', apply:s => s.hitGuard += .45 }
  ];

  let width = 0, height = 0, dpr = 1;
  let state = 'menu', previousState = 'menu', paused = false;
  let roomIndex = 0, score = 0, roomTime = 0, totalMesses = 0;
  let messes = [], monsters = [], particles = [], floaters = [];
  let targetMess = null, actionHeld = false, muted = false, audio = null;
  let last = performance.now();
  let player = { x:0, y:0, radius:17, vx:0, vy:0 };
  let stats = null;
  const keys = new Set();
  const stick = { pointer:null, x:0, y:0 };

  function defaultStats(){ return { reach:64, cleanSpeed:1, moveSpeed:225, timeBonus:0, scoreMult:1, monsterSlow:1, treasureMult:1, hitGuard:0, lastHit:-99 }; }
  function safeGetBest(){ try { return Number(localStorage.getItem('escapee:dungeon-janitor:best') || 0) || 0; } catch { return 0; } }
  function safeSetBest(value){ try { localStorage.setItem('escapee:dungeon-janitor:best', String(value)); } catch {} }

  function initAudio(){
    if (audio || muted) return;
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.().catch(()=>{}); } catch { audio = null; }
  }
  function tone(freq=320,duration=.06,type='sine',volume=.045){
    if (muted) return;
    initAudio(); if (!audio) return;
    try { const o=audio.createOscillator(), g=audio.createGain(); o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration); } catch {}
  }
  document.querySelector('#soundBtn').addEventListener('click',()=>{ muted=!muted; if(!muted) tone(420,.05); });

  function resize(){
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height; dpr = Math.min(devicePixelRatio || 1,2);
    canvas.width = Math.max(1,Math.round(width*dpr)); canvas.height = Math.max(1,Math.round(height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if (!player.x){ player.x=width/2; player.y=height/2; }
    player.x = Math.max(34,Math.min(width-34,player.x)); player.y = Math.max(72,Math.min(height-34,player.y));
  }

  function randomPoint(minTop=92){ return { x:42+Math.random()*Math.max(1,width-84), y:minTop+Math.random()*Math.max(1,height-minTop-82) }; }
  function pointAwayFromPlayer(minDist=100){
    for(let i=0;i<20;i++){ const p=randomPoint(); if(Math.hypot(p.x-player.x,p.y-player.y)>minDist) return p; }
    return randomPoint();
  }

  function spawnRoom(){
    player.x=width/2; player.y=Math.max(120,height/2); player.vx=player.vy=0;
    messes=[]; monsters=[]; particles=[]; floaters=[]; targetMess=null;
    roomTime = 42 + roomIndex*5 + stats.timeBonus;
    const count = 7 + roomIndex*2;
    const weighted = ['bones','bones','slime','weapon','spill','treasure'];
    for(let i=0;i<count;i++){
      const type = weighted[Math.min(weighted.length-1,Math.floor(Math.random()*(4+Math.min(2,roomIndex))))];
      const p=pointAwayFromPlayer(95);
      messes.push({ ...p, type, progress:0, radius:type==='slime'||type==='spill'?25:20, rot:Math.random()*Math.PI*2, seed:Math.random()*99 });
    }
    totalMesses = messes.length;
    const monsterCount = Math.min(3,Math.floor((roomIndex+1)/2));
    const monsterTypes = ['slime','skeleton','bat'];
    for(let i=0;i<monsterCount;i++){
      const p=pointAwayFromPlayer(180);
      monsters.push({ ...p, type:monsterTypes[(roomIndex+i)%monsterTypes.length], radius:17, angle:Math.random()*6.28, cooldown:4+Math.random()*4, hit:0 });
    }
    roomLabelEl.textContent=`Room ${roomIndex+1} of ${rooms.length}`; roomNameEl.textContent=rooms[roomIndex];
    updateHud();
  }

  function restart(){
    stats=defaultStats(); roomIndex=0; score=0; state='playing'; previousState='playing'; paused=false;
    startScreen.hidden=true; upgradeScreen.hidden=true; endScreen.hidden=true;
    spawnRoom(); last=performance.now(); initAudio(); tone(260,.08,'triangle');
  }

  function updateHud(){
    const cleaned = totalMesses ? (totalMesses-messes.length)/totalMesses : 0;
    cleanMeter.style.width=`${Math.round(cleaned*100)}%`;
    timeValue.textContent=Math.max(0,Math.ceil(roomTime));
    timeStat.classList.toggle('danger',roomTime<10);
    scoreValue.textContent=Math.round(score).toLocaleString();
  }

  function addParticles(x,y,color,count=8){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(let i=0;i<(reduced?Math.ceil(count/3):count);i++) particles.push({x,y,vx:(Math.random()-.5)*110,vy:(Math.random()-.5)*110,life:.45+Math.random()*.25,color,size:2+Math.random()*4});
  }
  function floater(x,y,text,color='#f7efd9'){ floaters.push({x,y,text,color,life:1}); }

  function cleanTarget(dt){
    if(!targetMess || !actionHeld) return;
    const info=messTypes[targetMess.type];
    targetMess.progress += dt*stats.cleanSpeed/info.duration;
    if(Math.random()<dt*12) addParticles(targetMess.x,targetMess.y,info.color,1);
    if(targetMess.progress>=1){
      let earned=info.points*stats.scoreMult*(targetMess.type==='treasure'?stats.treasureMult:1);
      score+=earned + Math.max(0,roomTime)*1.5;
      addParticles(targetMess.x,targetMess.y,info.color,13); floater(targetMess.x,targetMess.y-18,`+${Math.round(earned)}`,info.color); tone(targetMess.type==='treasure'?640:380,.08,'triangle');
      messes.splice(messes.indexOf(targetMess),1); targetMess=null;
      if(!messes.length) completeRoom();
    }
  }

  function completeRoom(){
    score += Math.ceil(roomTime)*20;
    tone(520,.12,'triangle'); setTimeout(()=>tone(700,.12,'triangle'),80);
    if(roomIndex>=rooms.length-1){ finish(true); return; }
    state='between-rounds'; previousState=state; actionHeld=false;
    document.querySelector('#roomSummary').textContent=`${rooms[roomIndex]} cleared with ${Math.ceil(roomTime)} seconds left. Management has issued exactly one supply.`;
    const choices=[...upgradePool].sort(()=>Math.random()-.5).slice(0,3);
    upgradeChoices.innerHTML='';
    choices.forEach(choice=>{
      const button=document.createElement('button'); button.type='button'; button.className='upgrade'; button.innerHTML=`<strong>${choice.name}</strong><span>${choice.text}</span>`;
      button.addEventListener('click',()=>{ choice.apply(stats); roomIndex++; upgradeScreen.hidden=true; state='playing'; previousState='playing'; spawnRoom(); tone(430,.07); });
      upgradeChoices.append(button);
    });
    upgradeScreen.hidden=false; upgradeChoices.querySelector('button')?.focus(); updateHud();
  }

  function finish(success){
    state='game-over'; previousState=state; actionHeld=false;
    const final=Math.round(score); const best=Math.max(final,safeGetBest()); safeSetBest(best);
    document.querySelector('#endEyebrow').textContent=success?'Shift complete':'Shift ended';
    document.querySelector('#endTitle').textContent=success?'The dungeon is presentable.':'The heroes arrived.';
    document.querySelector('#endSummary').textContent=success?`Six rooms cleared. Final sanitation score: ${final.toLocaleString()}.`:`They found ${messes.length} obvious mess${messes.length===1?'':'es'}. Final score: ${final.toLocaleString()}.`;
    document.querySelector('#bestLine').textContent=`Best shift: ${best.toLocaleString()}`;
    endScreen.hidden=false; window.EscapeeScores?.submit(final,{label:'Janitor score',display:`${final.toLocaleString()} pts · Room ${roomIndex+1}`}); tone(success?720:120,.28,success?'triangle':'sawtooth',.055);
  }

  function axes(){
    let x=stick.x,y=stick.y;
    if(keys.has('KeyA')||keys.has('ArrowLeft')) x-=1;
    if(keys.has('KeyD')||keys.has('ArrowRight')) x+=1;
    if(keys.has('KeyW')||keys.has('ArrowUp')) y-=1;
    if(keys.has('KeyS')||keys.has('ArrowDown')) y+=1;
    const len=Math.hypot(x,y); return len>1?{x:x/len,y:y/len}:{x,y};
  }

  function update(dt){
    if(state!=='playing'||paused) return;
    roomTime-=dt; if(roomTime<=0){ roomTime=0; updateHud(); finish(false); return; }
    const a=axes(); player.vx=a.x*stats.moveSpeed; player.vy=a.y*stats.moveSpeed;
    player.x=Math.max(30,Math.min(width-30,player.x+player.vx*dt)); player.y=Math.max(78,Math.min(height-30,player.y+player.vy*dt));
    targetMess=null; let nearest=Infinity;
    for(const mess of messes){ const d=Math.hypot(mess.x-player.x,mess.y-player.y); if(d<stats.reach+mess.radius&&d<nearest){nearest=d;targetMess=mess;} }
    cleanTarget(dt);

    for(const m of monsters){
      m.hit=Math.max(0,m.hit-dt); m.cooldown-=dt;
      let speed=(m.type==='bat'?95:m.type==='skeleton'?70:44)*stats.monsterSlow;
      let dx=0,dy=0;
      if(m.type==='skeleton'){ const d=Math.hypot(player.x-m.x,player.y-m.y)||1; dx=(player.x-m.x)/d;dy=(player.y-m.y)/d; }
      else { m.angle += (Math.random()-.5)*dt*2.4; dx=Math.cos(m.angle);dy=Math.sin(m.angle); }
      m.x+=dx*speed*dt;m.y+=dy*speed*dt;
      if(m.x<28||m.x>width-28){m.angle=Math.PI-m.angle;m.x=Math.max(28,Math.min(width-28,m.x));}
      if(m.y<82||m.y>height-28){m.angle=-m.angle;m.y=Math.max(82,Math.min(height-28,m.y));}
      if(m.type==='slime'&&m.cooldown<=0&&messes.length<totalMesses+3){ messes.push({x:m.x,y:m.y,type:'slime',progress:0,radius:22,rot:0,seed:Math.random()*99}); totalMesses++;m.cooldown=7+Math.random()*4;floater(m.x,m.y-18,'MORE SLIME','#79b75e'); }
      const d=Math.hypot(m.x-player.x,m.y-player.y);
      if(d<m.radius+player.radius&&m.hit<=0&&performance.now()/1000-stats.lastHit>.8){
        const penalty=Math.max(.6,2.2-stats.hitGuard);roomTime=Math.max(0,roomTime-penalty);stats.lastHit=performance.now()/1000;m.hit=.5;
        const nx=(player.x-m.x)/(d||1),ny=(player.y-m.y)/(d||1);player.x+=nx*24;player.y+=ny*24;floater(player.x,player.y-24,`-${penalty.toFixed(1)} SEC`,'#ff927f');tone(100,.1,'sawtooth');
      }
    }
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    for(const f of floaters){f.y-=28*dt;f.life-=dt;} floaters=floaters.filter(f=>f.life>0);
    updateHud();
  }

  function drawFloor(){
    ctx.fillStyle='#19161e';ctx.fillRect(0,0,width,height);
    const tile=54;ctx.strokeStyle='rgba(110,99,120,.13)';ctx.lineWidth=2;
    ctx.beginPath();for(let x=0;x<width+tile;x+=tile){ctx.moveTo(x,68);ctx.lineTo(x,height);}for(let y=68;y<height+tile;y+=tile){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
    const g=ctx.createRadialGradient(player.x,player.y,20,player.x,player.y,Math.max(230,Math.min(width,height)*.48));g.addColorStop(0,'rgba(238,202,132,.13)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=7;ctx.strokeRect(14,68,width-28,height-82);
  }

  function drawMess(m){
    const info=messTypes[m.type];ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.rot);
    if(m.type==='bones'){
      ctx.strokeStyle=info.color;ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-15,-8);ctx.lineTo(15,8);ctx.moveTo(-15,8);ctx.lineTo(15,-8);ctx.stroke();for(const x of [-15,15])for(const y of [-8,8]){ctx.beginPath();ctx.arc(x,y,4,0,6.28);ctx.stroke();}
    } else if(m.type==='slime'||m.type==='spill'){
      ctx.fillStyle=info.color;ctx.globalAlpha=.78;ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*6.28,r=m.radius*(.72+.22*Math.sin(i*2.7+m.seed));const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(-7,-5,5,0,6.28);ctx.fill();
    } else if(m.type==='weapon'){
      ctx.strokeStyle='#b78958';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-20,18);ctx.lineTo(18,-20);ctx.stroke();ctx.strokeStyle=info.color;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-2,-2);ctx.lineTo(20,-22);ctx.stroke();ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-8,7);ctx.lineTo(5,20);ctx.stroke();
    } else {
      ctx.fillStyle=info.color;ctx.beginPath();ctx.arc(-8,2,9,0,6.28);ctx.arc(9,-4,7,0,6.28);ctx.fill();ctx.strokeStyle='#8d6928';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
    if(m.progress>0){ctx.strokeStyle='rgba(0,0,0,.48)';ctx.lineWidth=7;ctx.beginPath();ctx.arc(m.x,m.y,m.radius+10,-Math.PI/2,Math.PI*1.5);ctx.stroke();ctx.strokeStyle='#f6efd9';ctx.lineWidth=4;ctx.beginPath();ctx.arc(m.x,m.y,m.radius+10,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,m.progress));ctx.stroke();}
  }

  function drawMonster(m){
    ctx.save();ctx.translate(m.x,m.y);ctx.globalAlpha=m.hit>0?.55:1;
    if(m.type==='slime'){ctx.fillStyle='#4d8d58';ctx.beginPath();ctx.arc(0,3,18,0,Math.PI,true);ctx.quadraticCurveTo(20,22,0,18);ctx.quadraticCurveTo(-20,22,-18,3);ctx.fill();ctx.fillStyle='#15161a';ctx.fillRect(-8,0,3,5);ctx.fillRect(6,0,3,5);}
    else if(m.type==='skeleton'){ctx.strokeStyle='#ddd5c1';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-8,10,0,6.28);ctx.moveTo(0,2);ctx.lineTo(0,18);ctx.moveTo(-12,8);ctx.lineTo(12,8);ctx.moveTo(0,18);ctx.lineTo(-9,29);ctx.moveTo(0,18);ctx.lineTo(9,29);ctx.stroke();}
    else {ctx.fillStyle='#63506e';ctx.beginPath();ctx.moveTo(0,2);ctx.quadraticCurveTo(-28,-18,-23,11);ctx.quadraticCurveTo(-10,5,0,18);ctx.quadraticCurveTo(10,5,23,11);ctx.quadraticCurveTo(28,-18,0,2);ctx.fill();ctx.fillStyle='#ffcf65';ctx.fillRect(-7,1,3,3);ctx.fillRect(4,1,3,3);}
    ctx.restore();
  }

  function drawPlayer(){
    const angle=Math.atan2(player.vy,player.vx)||0;ctx.save();ctx.translate(player.x,player.y);
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,15,22,10,0,0,6.28);ctx.fill();
    ctx.fillStyle='#5f8669';ctx.beginPath();ctx.arc(0,2,18,0,6.28);ctx.fill();ctx.fillStyle='#d7ae84';ctx.beginPath();ctx.arc(0,-14,10,0,6.28);ctx.fill();
    ctx.rotate(angle+.45);ctx.strokeStyle='#b68a57';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-2,-4);ctx.lineTo(30,22);ctx.stroke();ctx.strokeStyle='#d7d0bb';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(25,18);ctx.lineTo(42,31);ctx.stroke();ctx.restore();
    if(targetMess){ctx.strokeStyle=actionHeld?'#a8d6b0':'rgba(247,239,217,.48)';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(player.x,player.y,stats.reach,0,6.28);ctx.stroke();ctx.setLineDash([]);}
  }

  function draw(){
    drawFloor(); for(const m of messes) drawMess(m); for(const m of monsters) drawMonster(m); drawPlayer();
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.7);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.globalAlpha=1;
    ctx.textAlign='center';ctx.font='900 13px system-ui';for(const f of floaters){ctx.globalAlpha=Math.max(0,f.life);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;
    prompt.classList.toggle('visible',state==='playing'&&!!targetMess); if(targetMess) prompt.textContent=`Hold to ${messTypes[targetMess.type].label}`;
  }

  function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;update(dt);draw();requestAnimationFrame(frame);}

  addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'||e.code==='Enter')actionHeld=true;}} ,{passive:false});
  addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'||e.code==='Enter')actionHeld=false;});
  function clearInput(){keys.clear();actionHeld=false;stick.x=stick.y=0;stick.pointer=null;joystick.style.setProperty('--jx','0px');joystick.style.setProperty('--jy','0px');cleanBtn.classList.remove('active');}
  addEventListener('blur',clearInput);addEventListener('pagehide',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});addEventListener('escapee:pause',clearInput);

  function moveStick(e){const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const max=r.width*.28,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max;}stick.x=dx/max;stick.y=dy/max;joystick.style.setProperty('--jx',`${dx}px`);joystick.style.setProperty('--jy',`${dy}px`);}
  joystick.addEventListener('pointerdown',e=>{stick.pointer=e.pointerId;joystick.setPointerCapture?.(e.pointerId);moveStick(e);initAudio();});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stick.pointer)moveStick(e);});
  const releaseStick=e=>{if(stick.pointer!==null&&(!e||e.pointerId===stick.pointer)){stick.pointer=null;stick.x=stick.y=0;joystick.style.setProperty('--jx','0px');joystick.style.setProperty('--jy','0px');}};
  joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);joystick.addEventListener('lostpointercapture',releaseStick);
  cleanBtn.addEventListener('pointerdown',e=>{actionHeld=true;cleanBtn.classList.add('active');cleanBtn.setPointerCapture?.(e.pointerId);initAudio();});const releaseClean=()=>{actionHeld=false;cleanBtn.classList.remove('active');};cleanBtn.addEventListener('pointerup',releaseClean);cleanBtn.addEventListener('pointercancel',releaseClean);cleanBtn.addEventListener('lostpointercapture',releaseClean);

  document.querySelector('#startBtn').addEventListener('click',restart);document.querySelector('#againBtn').addEventListener('click',restart);
  window.EscapeeGame={
    restart,
    pause(){if(state==='playing'||state==='between-rounds'){previousState=state;paused=true;state='paused';clearInput();}},
    resume(){if(state==='paused'){state=previousState==='between-rounds'?'between-rounds':'playing';paused=false;last=performance.now();}},
    setMuted(value){
      muted = Boolean(value);
      if (!muted) {
        try { initAudio(); audio?.resume?.().catch?.(() => {}); } catch {}
      }
    },
    getStatus(){return state;}
  };
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,80));
  resize();stats=defaultStats();draw();requestAnimationFrame(frame);
})();
