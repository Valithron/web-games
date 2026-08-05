(() => {
  'use strict';
  const canvas = document.querySelector('#canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const startOverlay = document.querySelector('#startOverlay');
  const upgradeOverlay = document.querySelector('#upgradeOverlay');
  const endOverlay = document.querySelector('#endOverlay');
  const upgradeGrid = document.querySelector('#upgradeGrid');
  const toast = document.querySelector('#toast');
  const steerZone = document.querySelector('#steerZone');
  const shieldButton = document.querySelector('#shieldButton');
  const shieldLabel = document.querySelector('#shieldLabel');
  const hud = {
    wave: document.querySelector('#waveValue'), waveFill: document.querySelector('#waveFill'),
    health: document.querySelector('#healthValue'), people: document.querySelector('#peopleValue'),
    food: document.querySelector('#foodValue'), score: document.querySelector('#scoreValue')
  };

  const DROP_TYPES = {
    villager:{good:true,color:'#e8d4a3',label:'Villager',value:190,size:15}, wood:{good:true,color:'#a87545',label:'Wood',value:70,size:14},
    stone:{good:true,color:'#9aa1a5',label:'Stone',value:75,size:14}, food:{good:true,color:'#d18b50',label:'Food',value:85,size:14},
    coin:{good:true,color:'#edc95f',label:'Coins',value:120,size:12}, animal:{good:true,color:'#eee5cf',label:'Goat',value:145,size:14},
    boulder:{good:false,color:'#63676f',label:'Boulder',damage:18,size:20}, fire:{good:false,color:'#ef7d48',label:'Fireball',damage:13,size:17},
    raider:{good:false,color:'#b14f4f',label:'Raider',damage:10,size:16}, curse:{good:false,color:'#9a6ac0',label:'Cursed Idol',damage:7,size:15}
  };
  const BUILDINGS = {
    farm:{name:'Farm',text:'Produces food and keeps villagers working.',cost:'wood',color:'#8eaf63'},
    tower:{name:'Watchtower',text:'Shoots dangerous falling objects.',cost:'stone',color:'#9a7655'},
    wall:{name:'Stone Wall',text:'Adds keep health and widens the catch area.',cost:'stone',color:'#858b91'},
    market:{name:'Market',text:'Generates coins from surplus supplies.',cost:'wood',color:'#b98655'},
    brigade:{name:'Fire Brigade',text:'Reduces fireball damage.',cost:'wood',color:'#b85d4e'},
    temple:{name:'Temple',text:'Slowly repairs the keep and suppresses curses.',cost:'stone',color:'#b8b0d6'},
    barracks:{name:'Barracks',text:'Guards weaken raiders before impact.',cost:'wood',color:'#985c4e'},
    storehouse:{name:'Storehouse',text:'Caught supplies are worth more.',cost:'wood',color:'#ad885b'}
  };
  const UPGRADE_POOL = [
    {key:'farm',title:'Build Farm',desc:'Food production +1.2 per second.',apply:s=>s.buildings.farm++},
    {key:'tower',title:'Raise Watchtower',desc:'Automatically destroy more hazards.',apply:s=>s.buildings.tower++},
    {key:'wall',title:'Fortify Walls',desc:'+28 maximum health and a wider platform.',apply:s=>{s.buildings.wall++;s.maxHealth+=28;s.health=Math.min(s.maxHealth,s.health+28);}},
    {key:'market',title:'Open Market',desc:'Generate coins and passive score.',apply:s=>s.buildings.market++},
    {key:'brigade',title:'Train Fire Brigade',desc:'Fire damage is reduced by 45%.',apply:s=>s.buildings.brigade++},
    {key:'temple',title:'Build Temple',desc:'Repair the keep and weaken curses.',apply:s=>s.buildings.temple++},
    {key:'barracks',title:'Build Barracks',desc:'Raiders deal much less damage.',apply:s=>s.buildings.barracks++},
    {key:'storehouse',title:'Expand Storehouse',desc:'All caught resources score 25% more.',apply:s=>s.buildings.storehouse++},
    {key:'speed',title:'Royal Wheels',desc:'Kingdom movement speed +18%.',apply:s=>s.speed*=1.18},
    {key:'shield',title:'Charged Crown',desc:'Shield recharges 25% faster.',apply:s=>s.shieldRate*=1.25},
    {key:'people',title:'Refugee Quarter',desc:'Gain 3 villagers immediately.',apply:s=>s.people+=3},
    {key:'supplies',title:'Royal Granary',desc:'Gain wood, stone, and food.',apply:s=>{s.wood+=8;s.stone+=8;s.food+=14;}}
  ];

  let width=0,height=0,dpr=1,status='menu',paused=false,previousStatus='menu',last=performance.now();
  let drops=[],particles=[],floaters=[],villagers=[],shots=[];
  let state=null, keys=new Set(), steerPointer=null, steerX=0, touchTargetX=null;
  let audio=null, muted=false, toastTime=0;

  function freshState(){return {wave:1,waveTime:0,waveLength:43,score:0,health:100,maxHealth:100,people:2,food:12,wood:5,stone:3,coins:0,speed:285,shield:1,shieldActive:0,shieldRate:.055,spawn:0,production:0,shot:0,platformX:.5,buildings:{farm:0,tower:0,wall:0,market:0,brigade:0,temple:0,barracks:0,storehouse:0},ended:false};}
  function safeBest(){try{return Number(localStorage.getItem('escapee:falling-kingdom:best'))||0;}catch{return 0;}}
  function saveBest(v){try{localStorage.setItem('escapee:falling-kingdom:best',String(v));}catch{}}
  function initAudio(){if(audio||muted)return;try{audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume?.().catch(()=>{});}catch{audio=null;}}
  function tone(f=360,d=.07,type='triangle',vol=.04){if(muted)return;initAudio();if(!audio)return;try{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
  document.querySelector('#soundBtn').addEventListener('click',()=>{muted=!muted;if(!muted)tone(440,.05);showToast(muted?'Sound off':'Sound on');});

  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function platformWidth(){return Math.min(width*.72,150+state.buildings.wall*26+state.people*2.2);}
  function platformY(){return height-Math.max(82,Math.min(126,height*.18));}
  function platformLeft(){return state.platformX*width-platformWidth()/2;}
  function showToast(text,t=1.4){toast.textContent=text;toast.classList.add('visible');toastTime=t;}
  function addParticles(x,y,color,count=9){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;for(let i=0;i<(reduced?Math.ceil(count/3):count);i++)particles.push({x,y,vx:(Math.random()-.5)*150,vy:(Math.random()-.7)*150,life:.45+Math.random()*.35,color,size:2+Math.random()*4});}
  function floater(x,y,text,color='#fff1bd'){floaters.push({x,y,text,color,life:1});}

  function resetGame(){state=freshState();drops=[];particles=[];floaters=[];shots=[];villagers=[];for(let i=0;i<state.people;i++)spawnVillager(i);status='playing';previousStatus='playing';paused=false;startOverlay.hidden=true;upgradeOverlay.hidden=true;endOverlay.hidden=true;clearInputs();last=performance.now();initAudio();tone(310,.1);showToast('Catch what your kingdom needs');}
  function spawnVillager(i=0){villagers.push({x:.35+Math.random()*.3,y:0,tx:.2+Math.random()*.6,speed:.12+Math.random()*.09,phase:i+Math.random()*8,carrying:Math.random()<.25});}
  function clearInputs(){keys.clear();steerPointer=null;steerX=0;touchTargetX=null;shieldButton.classList.remove('active');}

  function weightedDrop(){const w=state.wave;const pool=['wood','wood','food','food','stone','villager','coin','animal','boulder'];if(w>1)pool.push('fire');if(w>2)pool.push('raider');if(w>3)pool.push('curse','boulder');return pool[Math.floor(Math.random()*pool.length)];}
  function spawnDrop(){const type=weightedDrop(),def=DROP_TYPES[type];drops.push({type,x:24+Math.random()*(width-48),y:-30,vy:88+state.wave*13+Math.random()*60,vx:(Math.random()-.5)*24,rot:Math.random()*6.28,spin:(Math.random()-.5)*2.2,size:def.size,dead:false});}
  function activateShield(){if(status!=='playing'||state.shield<.999||state.shieldActive>0)return;state.shield=0;state.shieldActive=4.2;shieldButton.classList.add('active');showToast('Royal shield raised');tone(620,.18,'sine',.05);}

  function catchDrop(d){const def=DROP_TYPES[d.type];const mult=1+state.buildings.storehouse*.25;if(def.good){let msg=def.label;switch(d.type){case'villager':state.people++;spawnVillager();msg='Villager rescued';break;case'wood':state.wood+=3;break;case'stone':state.stone+=3;break;case'food':state.food+=5;break;case'coin':state.coins+=4;break;case'animal':state.food+=2;state.people+=.15;msg='Goat joined the kingdom';break;}const gain=Math.round(def.value*mult);state.score+=gain;floater(d.x,platformY()-18,`+${gain}`,def.color);tone(d.type==='villager'?600:430,.07);addParticles(d.x,platformY(),def.color,10);}else{let damage=def.damage;if(d.type==='fire'&&state.buildings.brigade)damage*=.55;if(d.type==='raider'&&state.buildings.barracks)damage*=.45;if(d.type==='curse'&&state.buildings.temple)damage*=.5;if(state.shieldActive>0){state.score+=60;floater(d.x,platformY()-18,'BLOCKED','#bda8ff');tone(760,.05);addParticles(d.x,platformY(),'#bda8ff',12);}else{state.health-=damage;floater(d.x,platformY()-18,`-${Math.ceil(damage)}`,'#ff8d78');tone(100,.12,'sawtooth');addParticles(d.x,platformY(),def.color,14);if(d.type==='fire')showToast('Fire in the kingdom');if(d.type==='raider'&&state.people>1&&Math.random()<.35)state.people=Math.max(1,state.people-1);}}d.dead=true;}

  function updateProduction(dt){state.production+=dt;if(state.production<1)return;state.production-=1;const workers=Math.max(1,Math.floor(state.people));if(state.buildings.farm)state.food+=state.buildings.farm*1.2;if(state.buildings.market){state.coins+=state.buildings.market*.45;state.score+=state.buildings.market*10;}if(state.buildings.temple)state.health=Math.min(state.maxHealth,state.health+state.buildings.temple*.5);state.food-=Math.max(.12,workers*.055);if(state.food<0){state.food=0;state.health-=.65;}
    while(villagers.length<Math.floor(state.people))spawnVillager(villagers.length);while(villagers.length>Math.ceil(state.people))villagers.pop();}
  function updateTowers(dt){state.shot-=dt;if(state.buildings.tower<=0||state.shot>0)return;const target=drops.filter(d=>!d.dead&&!DROP_TYPES[d.type].good&&d.y>30).sort((a,b)=>b.y-a.y)[0];if(!target)return;state.shot=Math.max(.28,1.05-state.buildings.tower*.13);shots.push({x:state.platformX*width,y:platformY()-46,tx:target.x,ty:target.y,life:.18,target});tone(540,.035,'square',.018);if(Math.random()<Math.min(.85,.38+state.buildings.tower*.15)){target.dead=true;state.score+=90;addParticles(target.x,target.y,'#f4d27b',8);floater(target.x,target.y,'SHOT','#f4d27b');}}
  function updateVillagers(dt){for(const v of villagers){v.x+=(v.tx-v.x)*dt*v.speed;if(Math.abs(v.tx-v.x)<.03)v.tx=.12+Math.random()*.76;v.phase+=dt*(2+v.speed*4);if(Math.random()<dt*.035)v.carrying=!v.carrying;}}

  function completeWave(){status='between-rounds';previousStatus=status;clearInputs();state.score+=Math.round(state.health*4+state.people*70);document.querySelector('#waveComplete').textContent=`Wave ${state.wave} survived`;document.querySelector('#waveSummary').textContent=`${Math.floor(state.people)} villagers remain. The kingdom has ${Math.floor(state.food)} food, ${Math.floor(state.wood)} wood, and ${Math.floor(state.stone)} stone.`;const choices=[...UPGRADE_POOL].sort(()=>Math.random()-.5).slice(0,3);upgradeGrid.replaceChildren();for(const u of choices){const b=document.createElement('button');b.type='button';b.className='upgrade';b.innerHTML=`<strong>${u.title}</strong><span>${u.desc}</span><em>${u.key}</em>`;b.addEventListener('click',()=>{u.apply(state);state.wave++;state.waveTime=0;state.waveLength=Math.min(55,state.waveLength+1.5);state.health=Math.min(state.maxHealth,state.health+8);status='playing';previousStatus='playing';upgradeOverlay.hidden=true;last=performance.now();tone(470,.09);showToast(`Wave ${state.wave} begins`);},{once:true});upgradeGrid.append(b);}upgradeOverlay.hidden=false;upgradeGrid.querySelector('button')?.focus();}
  function endGame(){if(state.ended)return;state.ended=true;status='game-over';clearInputs();const final=Math.max(0,Math.floor(state.score));const best=Math.max(final,safeBest());if(best>safeBest())saveBest(best);document.querySelector('#finalScore').textContent=final.toLocaleString();document.querySelector('#bestScore').textContent=best.toLocaleString();document.querySelector('#endSummary').textContent=`The kingdom reached wave ${state.wave} with ${Math.floor(state.people)} villagers and ${Object.values(state.buildings).reduce((a,b)=>a+b,0)} buildings.`;endOverlay.hidden=false;tone(120,.32,'sawtooth',.055);window.EscapeeScores?.submit(final,{label:'Kingdom score',display:`${final.toLocaleString()} pts · Wave ${state.wave}`});}

  function update(dt){if(status!=='playing'||paused)return;state.waveTime+=dt;state.spawn-=dt;toastTime-=dt;if(toastTime<=0)toast.classList.remove('visible');
    const axis=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);if(touchTargetX!==null){const current=state.platformX*width;const diff=touchTargetX-current;steerX=Math.max(-1,Math.min(1,diff/70));if(Math.abs(diff)<5)touchTargetX=null;}else steerX=axis;state.platformX=Math.max(platformWidth()/2/width,Math.min(1-platformWidth()/2/width,state.platformX+steerX*state.speed/width*dt));
    if((keys.has('Space')||keys.has('Enter')))activateShield();state.shield=Math.min(1,state.shield+state.shieldRate*dt);state.shieldActive=Math.max(0,state.shieldActive-dt);shieldButton.classList.toggle('active',state.shieldActive>0);shieldButton.classList.toggle('cooldown',state.shield<.999&&state.shieldActive<=0);shieldLabel.textContent=state.shieldActive>0?'Active':state.shield>=.999?'Ready':`${Math.floor(state.shield*100)}%`;
    if(state.spawn<=0){spawnDrop();state.spawn=Math.max(.16,.7-state.wave*.035)+Math.random()*.34;}
    updateProduction(dt);updateTowers(dt);updateVillagers(dt);
    const left=platformLeft(),right=left+platformWidth(),py=platformY();for(const d of drops){if(d.dead)continue;d.vy+=dt*9;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.spin*dt;if(d.y+d.size>=py&&d.y<py+38&&d.x>left-6&&d.x<right+6)catchDrop(d);else if(d.y>height+35)d.dead=true;}
    drops=drops.filter(d=>!d.dead);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);for(const f of floaters){f.y-=30*dt;f.life-=dt;}floaters=floaters.filter(f=>f.life>0);for(const s of shots)s.life-=dt;shots=shots.filter(s=>s.life>0);
    state.score+=dt*(state.wave*2+state.people*.6);if(state.health<=0||state.people<.75){state.health=Math.max(0,state.health);endGame();return;}if(state.waveTime>=state.waveLength)completeWave();updateHud();}

  function updateHud(){hud.wave.textContent=state?.wave??1;hud.waveFill.style.transform=`scaleX(${state?Math.min(1,state.waveTime/state.waveLength):0})`;hud.health.textContent=Math.max(0,Math.ceil(state?.health??100));hud.people.textContent=Math.max(0,Math.floor(state?.people??2));hud.food.textContent=Math.max(0,Math.floor(state?.food??12));hud.score.textContent=Math.floor(state?.score??0).toLocaleString();}

  function drawSky(){const g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,'#253752');g.addColorStop(.58,'#526072');g.addColorStop(1,'#88735b');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);ctx.fillStyle='rgba(255,230,171,.16)';ctx.beginPath();ctx.arc(width*.18,height*.2,Math.min(width,height)*.09,0,6.28);ctx.fill();for(let i=0;i<18;i++){const x=(i*83+state.waveTime*7)% (width+120)-60,y=55+(i%5)*47;ctx.fillStyle='rgba(235,238,238,.13)';ctx.beginPath();ctx.ellipse(x,y,55+(i%3)*20,14+(i%2)*7,0,0,6.28);ctx.fill();}}
  function drawDrop(d){const def=DROP_TYPES[d.type];ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle='rgba(0,0,0,.17)';ctx.beginPath();ctx.ellipse(4,7,d.size,d.size*.55,0,0,6.28);ctx.fill();ctx.fillStyle=def.color;if(d.type==='villager'){ctx.beginPath();ctx.arc(0,-5,6,0,6.28);ctx.fill();ctx.fillRect(-6,2,12,15);}else if(d.type==='wood'){ctx.fillRect(-15,-8,30,16);ctx.strokeStyle='#6b472c';ctx.lineWidth=3;ctx.strokeRect(-15,-8,30,16);}else if(d.type==='stone'||d.type==='boulder'){ctx.beginPath();for(let i=0;i<7;i++){const a=i/7*6.28,r=d.size*(.78+(i%2)*.18);i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}else if(d.type==='food'){ctx.beginPath();ctx.arc(-5,1,9,0,6.28);ctx.arc(6,-2,7,0,6.28);ctx.fill();}else if(d.type==='coin'){ctx.beginPath();ctx.arc(0,0,11,0,6.28);ctx.fill();ctx.strokeStyle='#fff1a6';ctx.lineWidth=3;ctx.stroke();}else if(d.type==='animal'){ctx.fillRect(-12,-5,24,14);ctx.beginPath();ctx.arc(12,-5,8,0,6.28);ctx.fill();}else if(d.type==='fire'){ctx.beginPath();ctx.arc(0,5,13,0,6.28);ctx.fill();ctx.fillStyle='#ffd05a';ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(0,-22);ctx.lineTo(9,0);ctx.fill();}else if(d.type==='raider'){ctx.fillRect(-10,-10,20,25);ctx.fillStyle='#ded7ca';ctx.fillRect(-7,-17,14,9);ctx.strokeStyle='#ece3ce';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,-5);ctx.lineTo(18,15);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(13,10);ctx.lineTo(-13,10);ctx.closePath();ctx.fill();}ctx.restore();}
  function drawBuilding(type,index,total){const b=BUILDINGS[type],count=state.buildings[type];if(!count)return;const pw=platformWidth(),left=platformLeft(),baseY=platformY()-4;for(let n=0;n<count;n++){const slot=(index+n*.8+1)/(total+2);const x=left+slot*pw,y=baseY-22-(n%2)*8;ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(x-14,y+5,30,25);ctx.fillStyle=b.color;ctx.fillRect(x-15,y-8,30,27);ctx.fillStyle='#574635';ctx.beginPath();ctx.moveTo(x-19,y-8);ctx.lineTo(x,y-24);ctx.lineTo(x+19,y-8);ctx.fill();ctx.fillStyle='#ffd982';ctx.fillRect(x-5,y+2,10,10);if(type==='tower'){ctx.fillStyle='#66513d';ctx.fillRect(x-8,y-35,16,28);ctx.fillStyle='#d6c7a3';ctx.fillRect(x-13,y-39,26,7);}}}
  function drawKingdom(){const py=platformY(),pw=platformWidth(),left=platformLeft();ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(state.platformX*width,py+37,pw*.52,18,0,0,6.28);ctx.fill();ctx.fillStyle='#66513e';ctx.fillRect(left,py,pw,38);ctx.fillStyle='#8b704f';ctx.fillRect(left,py,pw,11);ctx.strokeStyle='#c6a76e';ctx.lineWidth=3;for(let x=left+8;x<left+pw;x+=22){ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x,py+38);ctx.stroke();}const total=Object.values(state.buildings).reduce((a,b)=>a+b,0)+4;let idx=0;for(const type of Object.keys(state.buildings)){drawBuilding(type,idx,total);idx+=state.buildings[type]+.7;}
    const cx=state.platformX*width;ctx.fillStyle='#8d7659';ctx.fillRect(cx-24,py-58,48,58);ctx.fillStyle='#5e4b3d';ctx.beginPath();ctx.moveTo(cx-30,py-58);ctx.lineTo(cx,py-85);ctx.lineTo(cx+30,py-58);ctx.fill();ctx.fillStyle='#f0c969';ctx.fillRect(cx-6,py-27,12,27);ctx.fillStyle='#c84f4f';ctx.fillRect(cx+20,py-83,4,27);ctx.beginPath();ctx.moveTo(cx+24,py-83);ctx.lineTo(cx+45,py-76);ctx.lineTo(cx+24,py-69);ctx.fill();
    for(let i=0;i<villagers.length;i++){const v=villagers[i],x=left+v.x*pw,y=py-4-Math.sin(v.phase)*2;ctx.fillStyle='#e0b98d';ctx.beginPath();ctx.arc(x,y-13,4,0,6.28);ctx.fill();ctx.fillStyle=i%3===0?'#6d8a66':i%3===1?'#7a6b95':'#8c6656';ctx.fillRect(x-4,y-9,8,10);if(v.carrying){ctx.fillStyle='#a87545';ctx.fillRect(x+5,y-8,7,7);}}
    if(state.shieldActive>0){ctx.strokeStyle=`rgba(190,170,255,${.55+Math.sin(performance.now()*.012)*.18})`;ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,py-28,pw*.55,Math.PI,Math.PI*2);ctx.stroke();}}
  function draw(){if(!state){ctx.fillStyle='#172231';ctx.fillRect(0,0,width,height);return;}drawSky();for(const d of drops)drawDrop(d);for(const s of shots){ctx.strokeStyle=`rgba(255,224,137,${Math.max(0,s.life/.18)})`;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.tx,s.ty);ctx.stroke();}drawKingdom();for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.8);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.globalAlpha=1;ctx.textAlign='center';ctx.font='900 13px system-ui';for(const f of floaters){ctx.globalAlpha=Math.max(0,f.life);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;}
  function frame(now){const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;update(dt);draw();requestAnimationFrame(frame);}

  addEventListener('keydown',e=>{if(['KeyA','KeyD','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'||e.code==='Enter')activateShield();}},{passive:false});addEventListener('keyup',e=>keys.delete(e.code));
  function steerAt(e){const r=canvas.getBoundingClientRect();touchTargetX=e.clientX-r.left;}
  canvas.addEventListener('pointerdown',e=>{if(e.target!==canvas)return;steerPointer=e.pointerId;canvas.setPointerCapture?.(e.pointerId);steerAt(e);initAudio();});canvas.addEventListener('pointermove',e=>{if(e.pointerId===steerPointer)steerAt(e);});const releaseSteer=e=>{if(steerPointer===null||!e||e.pointerId===steerPointer){steerPointer=null;touchTargetX=null;steerX=0;}};canvas.addEventListener('pointerup',releaseSteer);canvas.addEventListener('pointercancel',releaseSteer);canvas.addEventListener('lostpointercapture',releaseSteer);
  steerZone.addEventListener('pointerdown',e=>{steerPointer=e.pointerId;steerZone.setPointerCapture?.(e.pointerId);steerAt(e);initAudio();});steerZone.addEventListener('pointermove',e=>{if(e.pointerId===steerPointer)steerAt(e);});steerZone.addEventListener('pointerup',releaseSteer);steerZone.addEventListener('pointercancel',releaseSteer);steerZone.addEventListener('lostpointercapture',releaseSteer);
  shieldButton.addEventListener('pointerdown',e=>{e.preventDefault();shieldButton.setPointerCapture?.(e.pointerId);activateShield();});
  addEventListener('blur',clearInputs);addEventListener('pagehide',clearInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});addEventListener('escapee:pause',clearInputs);
  document.querySelector('#startButton').addEventListener('click',resetGame);document.querySelector('#restartButton').addEventListener('click',resetGame);
  window.EscapeeGame={restart:resetGame,pause(){if(status==='playing'||status==='between-rounds'){previousStatus=status;paused=true;status='paused';clearInputs();}},resume(){if(status==='paused'){status=previousStatus;paused=false;last=performance.now();}},setMuted(){muted=!muted;},getStatus(){return status;}};
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,90));resize();updateHud();requestAnimationFrame(frame);
})();