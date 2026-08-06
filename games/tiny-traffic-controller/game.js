import { createEscapeeStorage } from '/shared/storage.js';

const canvas=document.querySelector('#canvas'),ctx=canvas.getContext('2d');
const scoreEl=document.querySelector('#score'),timeEl=document.querySelector('#time'),clearedEl=document.querySelector('#cleared'),livesEl=document.querySelector('#lives'),statusEl=document.querySelector('#status'),warningEl=document.querySelector('#warning');
const startOverlay=document.querySelector('#startOverlay'),endOverlay=document.querySelector('#endOverlay'),switchButton=document.querySelector('#switchButton'),repairButton=document.querySelector('#repairButton'),repairCount=document.querySelector('#repairCount');
const storage=createEscapeeStorage('tiny-traffic-controller');
let W=0,H=0,dpr=1,last=performance.now(),running=false,paused=false,state='title';
let axis='NS',phase='green',phaseTimer=0,elapsed=0,score=0,cleared=0,lives=3,spawnTimer=0,vehicles=[],peds=[],train=null,malfunction=0,emergencyTimer=0;
const lanes=['N','S','E','W'];
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);visualViewport?.addEventListener('resize',resize);resize();
function reset(){elapsed=score=cleared=0;lives=3;axis='NS';phase='green';phaseTimer=0;spawnTimer=.7;vehicles=[];peds=[];train=null;malfunction=0;emergencyTimer=0;running=true;paused=false;state='playing';startOverlay.hidden=true;endOverlay.hidden=true;updateHud()}
function updateHud(){scoreEl.textContent=Math.floor(score);clearedEl.textContent=cleared;livesEl.textContent='● '.repeat(lives).trim()+' ○'.repeat(3-lives);timeEl.textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;statusEl.textContent=phase==='green'?`${axis==='NS'?'North–South':'East–West'} Green`:phase==='yellow'?'Yellow':phase==='allred'?'All Stop · Pedestrians':'Changing';switchButton.textContent=axis==='NS'?'Switch to East–West':'Switch to North–South';switchButton.disabled=phase!=='green'||malfunction>0;repairButton.hidden=malfunction<=0;repairCount.textContent=malfunction}
function triggerSwitch(){if(!running||paused||phase!=='green'||malfunction>0)return;phase='yellow';phaseTimer=1.15;updateHud()}
function roadTap(e){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(Math.abs(x-W/2)<W*.38||Math.abs(y-H/2)<H*.38)triggerSwitch()}
canvas.addEventListener('pointerdown',roadTap);switchButton.addEventListener('click',triggerSwitch);
function repair(){if(malfunction>0){malfunction--;if(!malfunction){warning('Lights repaired');}updateHud()}}
repairButton.addEventListener('click',repair);
addEventListener('keydown',e=>{if(endOverlay.hidden===false)return;if([' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();triggerSwitch()}if(e.key.toLowerCase()==='r')repair()});
document.querySelector('#startButton').onclick=reset;document.querySelector('#restartButton').onclick=reset;
function spawnVehicle(){const side=lanes[Math.floor(Math.random()*4)],emergency=elapsed>150&&Math.random()<.1;vehicles.push({side,t:0,speed:(emergency?95:62)+(elapsed*.22)+Math.random()*18,route:['straight','left','right'][Math.floor(Math.random()*3)],wait:0,emergency,deadline:emergency?9:999,passed:false})}
function activeFor(side){return axis==='NS'?(side==='N'||side==='S'):(side==='E'||side==='W')}
function pos(v){const cx=W/2,cy=H/2,L=Math.max(W,H)*.62,p=Math.min(v.t,1.2);if(v.side==='N')return{x:cx-18,y:cy-L/2+p*L,a:Math.PI/2};if(v.side==='S')return{x:cx+18,y:cy+L/2-p*L,a:-Math.PI/2};if(v.side==='E')return{x:cx+L/2-p*L,y:cy-18,a:Math.PI};return{x:cx-L/2+p*L,y:cy+18,a:0}}
function warning(text){warningEl.textContent=text;warningEl.classList.add('show');clearTimeout(warning._t);warning._t=setTimeout(()=>warningEl.classList.remove('show'),1200)}
function crash(){if(!running)return;lives--;warning('Collision!');vehicles=[];peds=[];phase='allred';phaseTimer=1.2;if(lives<=0)finish();updateHud()}
function finish(){running=false;state='game-over';const final=Math.floor(score),best=Math.max(final,Number(storage.get('best')||0));storage.set('best',best);document.querySelector('#finalScore').textContent=final;document.querySelector('#bestScore').textContent=best;document.querySelector('#summary').textContent=`${timeEl.textContent} survived · ${cleared} vehicles cleared`;endOverlay.hidden=false;window.EscapeeScores?.submit(final,{label:'Final score',display:`${final.toLocaleString()} points`})}
function update(dt){elapsed+=dt;score+=dt*2;spawnTimer-=dt;if(spawnTimer<=0){spawnVehicle();spawnTimer=Math.max(.35,1.5-elapsed*.006)+Math.random()*.45}
 if(phase!=='green'){phaseTimer-=dt;if(phaseTimer<=0){if(phase==='yellow'){phase='allred';phaseTimer=.9;if(elapsed>80&&Math.random()<.55)peds.push({t:0})}else{axis=axis==='NS'?'EW':'NS';phase='green'}updateHud()}}
 if(elapsed>240&&!malfunction&&Math.random()<dt*.035){malfunction=3;warning('Signal malfunction');updateHud()}
 if(elapsed>210&&!train&&Math.random()<dt*.025)train={t:0,duration:5+Math.random()*3};if(train){train.t+=dt;if(train.t>train.duration)train=null}
 for(const p of peds)p.t+=dt*.7;peds=peds.filter(p=>p.t<1);
 for(const v of vehicles){const can=phase==='green'&&activeFor(v.side)&&!(train&&v.side==='E');const near=v.t>.34&&v.t<.56;if(!can&&near){v.wait+=dt;v.deadline-=dt;if(v.emergency&&v.deadline<=0){crash();return}if(v.wait>8&&!v.emergency&&Math.random()<dt*.22)v.t+=dt*v.speed/Math.max(W,H)}else v.t+=dt*v.speed/Math.max(W,H);if(v.emergency&&can&&v.deadline>0)score+=dt*3}
 for(let i=0;i<vehicles.length;i++)for(let j=i+1;j<vehicles.length;j++){const a=pos(vehicles[i]),b=pos(vehicles[j]);if(Math.hypot(a.x-b.x,a.y-b.y)<22&&vehicles[i].t>.42&&vehicles[i].t<.72&&vehicles[j].t>.42&&vehicles[j].t<.72){crash();return}}
 vehicles=vehicles.filter(v=>{if(v.t>1.05){cleared++;score+=v.emergency?20+Math.max(0,v.deadline)*2:1;return false}return true});updateHud()}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#486e57';ctx.fillRect(0,0,W,H);const rw=Math.min(W,H)*.25,cx=W/2,cy=H/2;ctx.fillStyle='#30383d';ctx.fillRect(cx-rw/2,0,rw,H);ctx.fillRect(0,cy-rw/2,W,rw);ctx.strokeStyle='#e8d98b';ctx.lineWidth=3;ctx.setLineDash([18,16]);ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,H);ctx.moveTo(0,cy);ctx.lineTo(W,cy);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#f7f2de';for(let i=-2;i<=2;i++){ctx.fillRect(cx-rw/2+i*12,cy-rw/2-12,7,10);ctx.fillRect(cx-rw/2+i*12,cy+rw/2+2,7,10);ctx.fillRect(cx-rw/2-12,cy-rw/2+i*12,10,7);ctx.fillRect(cx+rw/2+2,cy-rw/2+i*12,10,7)}
 if(train){ctx.fillStyle='#663e2d';ctx.fillRect(cx+rw*.7,0,8,H);ctx.fillStyle='#d94f43';ctx.fillRect(cx+rw*.55,cy-rw*.7,80,18)}
 for(const p of peds){ctx.fillStyle='#f6d365';ctx.beginPath();ctx.arc(cx-rw/2+p.t*rw,cy-rw/2-7,5,0,7);ctx.fill()}
 for(const v of vehicles){const q=pos(v);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a);ctx.fillStyle=v.emergency?'#f5f7fb':['#e65b4f','#4aa3df','#f3b941','#8d68c4'][lanes.indexOf(v.side)];ctx.fillRect(-12,-7,24,14);if(v.emergency){ctx.fillStyle='#6ed5ff';ctx.fillRect(-6,-9,5,3);ctx.fillStyle='#ff5f5f';ctx.fillRect(1,-9,5,3)}ctx.restore()}
 const greenNS=phase==='green'&&axis==='NS',greenEW=phase==='green'&&axis==='EW';for(const [x,y,g] of [[cx-rw/2-20,cy-rw/2-20,greenNS],[cx+rw/2+20,cy+rw/2+20,greenNS],[cx+rw/2+20,cy-rw/2-20,greenEW],[cx-rw/2-20,cy+rw/2+20,greenEW]]){ctx.fillStyle='#142126';ctx.fillRect(x-8,y-12,16,24);ctx.fillStyle=phase==='yellow'?'#ffd84a':g?'#56d37a':'#ef554d';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill()}}
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(running&&!paused)update(dt);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
window.EscapeeGame={restart:reset,pause:()=>{paused=true;state='paused'},resume:()=>{paused=false;state=running?'playing':state;last=performance.now()},setMuted(){},getStatus:()=>state};
