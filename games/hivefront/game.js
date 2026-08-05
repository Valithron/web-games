const canvas=document.querySelector('#canvas');
const ctx=canvas.getContext('2d');
const menu=document.querySelector('#menu');
const stageTabs=document.querySelector('#stageTabs');
const levelGrid=document.querySelector('#levelGrid');
const continueButton=document.querySelector('#continueButton');
const hud=document.querySelector('#hud');
const levelLabel=document.querySelector('#levelLabel');
const levelTitle=document.querySelector('#levelTitle');
const timerEl=document.querySelector('#timer');
const sealTarget=document.querySelector('#sealTarget');
const hint=document.querySelector('#hint');
const result=document.querySelector('#result');
const resultEyebrow=document.querySelector('#resultEyebrow');
const resultTitle=document.querySelector('#resultTitle');
const resultDetail=document.querySelector('#resultDetail');
const resultSeals=document.querySelector('#resultSeals');
const retryButton=document.querySelector('#retryButton');
const nextButton=document.querySelector('#nextButton');
const levelsButton=document.querySelector('#levelsButton');

const FACTIONS={yellow:{color:'#f4c84b',symbol:'⬡'},red:{color:'#e75a4f',symbol:'▲'},blue:{color:'#5ba7e7',symbol:'◆'},purple:{color:'#a979dc',symbol:'◇'},neutral:{color:'#9ca1a8',symbol:'○'}};
const STAGES=['First Flight','The Watchtowers','The Blue March','Crossed Paths','The Purple Gambit','War for the Board'];
const TITLES=['First Crossing','Open Ground','The Quiet Hive','Half Measures','Meeting Line','Forked Trail','Second Nest','Pressure Point','Closing Wings','Redoubt','Stone Watch','Narrow Passage','Outer Guard','Twin Towers','Long Approach','Crossfire','Tower Chain','Broken Gate','The Hard Route','Watchkeeper','Blue Arrival','Claim the Center','Three Corners','Growing Front','Split Attention','Border Hive','Patient Strike','Middle Kingdom','Two Rivals','Blue March','Long Roads','Counterflow','Island Hive','False Opening','Deep Reinforcement','Route War','The Far Side','Crossed Paths','Rear Attack','Tangled Board','Purple Appears','Carrion Move','Four Colors','Weakest Link','Borrowed Battle','Changing Hands','Three Fronts','Late Capture','The Gambit','Purple Crown','Asymmetric','Hard Center','Tower Web','No Safe Edge','Last Reserve','Four-Way War','Measured Risk','Hivefall','Final Choke','Dominion'];

function makeLevel(index){
  const stage=Math.floor(index/10)+1,slot=index%10+1;
  const factions=['yellow','red']; if(stage>=3)factions.push('blue'); if(stage>=5)factions.push('purple');
  const count=Math.min(4+Math.floor(index/4),10);
  const nodes=[];
  const ring=count-1;
  nodes.push({id:'n0',type:'hive',owner:'neutral',units:10+stage*3,x:.5,y:.5});
  for(let i=0;i<ring;i++){
    const angle=-Math.PI/2+i*Math.PI*2/ring+(slot%2?.12:0);
    const radiusX=.32+(i%2)*.035,radiusY=.31+(i%3===0?.035:0);
    let owner='neutral';
    if(i===0)owner='yellow';
    else if(i===Math.floor(ring/2))owner='red';
    else if(stage>=3&&i===Math.floor(ring/3))owner='blue';
    else if(stage>=5&&i===Math.floor(ring*2/3))owner='purple';
    const tower=stage>=2&&((i+slot)%Math.max(3,6-stage)===0);
    nodes.push({id:`n${i+1}`,type:tower?'tower':'hive',owner,units:owner==='neutral'?8+((i*7+slot*3)%28):28+((i*11+slot*5)%24),x:.5+Math.cos(angle)*radiusX,y:.5+Math.sin(angle)*radiusY});
  }
  const routes=[]; const add=(a,b)=>{if(a===b)return;const key=[a,b].sort().join('-');if(!routes.some(r=>r.key===key))routes.push({key,a,b});};
  for(let i=1;i<=ring;i++){add(i,i===ring?1:i+1); if((i+slot)%2===0)add(0,i);}
  if(stage>=2){for(let i=1;i<=ring;i+=3)add(i,((i+Math.floor(ring/2)-1)%ring)+1);}
  if(stage>=4){for(let i=2;i<=ring;i+=3)add(i,((i+2-1)%ring)+1);}
  return {id:index,stage,slot,title:TITLES[index],factions,nodes,routes,par:Math.max(95,150-index),expert:Math.max(65,112-index*.7),hint:index===0?'Drag from your yellow hive to the gray hive. Every order sends half.':index===1?'Build numbers, then send repeated half-force waves.':index===10?'Guard towers fire along every connected route. Take them with overwhelming force.':''};
}
const LEVELS=Array.from({length:60},(_,i)=>makeLevel(i));

let selectedStage=1,selectedLevel=0,state=null,lastTime=performance.now(),raf=0,dpr=1,width=1,height=1,paused=false,pointer=null,keyboardNode=0,sound=true;
let progress=loadProgress();
function loadProgress(){try{return JSON.parse(localStorage.getItem('hivefront-progress'))||{unlocked:0,seals:{},best:{}}}catch{return{unlocked:0,seals:{},best:{}}}}
function saveProgress(){try{localStorage.setItem('hivefront-progress',JSON.stringify(progress))}catch{}}
function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);width=Math.max(1,r.width);height=Math.max(1,r.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);visualViewport?.addEventListener('resize',resize);resize();

function renderMenu(){stageTabs.innerHTML='';for(let s=1;s<=6;s++){const b=document.createElement('button');b.textContent=s;b.title=STAGES[s-1];b.className=s===selectedStage?'active':'';b.disabled=progress.unlocked<(s-1)*10;b.onclick=()=>{selectedStage=s;selectedLevel=(s-1)*10;renderMenu()};stageTabs.append(b)}levelGrid.innerHTML='';for(let i=(selectedStage-1)*10;i<selectedStage*10;i++){const b=document.createElement('button');b.disabled=i>progress.unlocked;b.className=i===selectedLevel?'selected':'';b.innerHTML=`${i+1}<span class="seals">${'★'.repeat(progress.seals[i]||0)}</span>`;b.onclick=()=>{selectedLevel=i;renderMenu()};levelGrid.append(b)}continueButton.textContent=selectedLevel===0&&!progress.best[0]?'Begin Campaign':`Play ${selectedLevel+1}: ${LEVELS[selectedLevel].title}`}

function startLevel(index){selectedLevel=index;const level=LEVELS[index];state={level,time:0,nodes:level.nodes.map((n,i)=>({...n,index:i,capacity:n.type==='tower'?150:100,prod:0,towerClock:0})),routes:level.routes.map(r=>({...r,units:[]})),orders:[],ended:false,aiClock:0};menu.classList.add('hidden');result.classList.add('hidden');hud.classList.remove('hidden');hint.classList.toggle('hidden',!level.hint);hint.textContent=level.hint;levelLabel.textContent=`${level.stage}-${level.slot}`;levelTitle.textContent=level.title;sealTarget.textContent=`★★ ${formatTime(level.par)}`;paused=false;pointer=null;keyboardNode=state.nodes.findIndex(n=>n.owner==='yellow');lastTime=performance.now()}
function toScreen(n){const portrait=height>width;const padX=portrait?44:80,padTop=portrait?105:70,padBottom=portrait?90:55;return{x:padX+n.x*(width-padX*2),y:padTop+n.y*(height-padTop-padBottom)}}
function routeFor(a,b){return state.routes.find(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a))}
function connected(a){return state.routes.flatMap(r=>r.a===a?[r.b]:r.b===a?[r.a]:[])}
function issueOrder(from,to,owner='yellow'){const a=state.nodes[from];if(!a||a.owner!==owner)return false;const route=routeFor(from,to);if(!route)return false;const count=Math.floor(a.units/2);if(count<1)return false;a.units-=count;state.orders.push({from,to,owner,remaining:count,clock:0});return true}
function unitPosition(u,route){const a=toScreen(state.nodes[route.a]),b=toScreen(state.nodes[route.b]);const forward=u.from===route.a;const t=forward?u.t:1-u.t;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function update(dt){if(!state||state.ended||paused)return;state.time+=dt;state.aiClock-=dt;
  for(const n of state.nodes){if(n.type==='hive'&&n.owner!=='neutral'&&n.units<n.capacity){n.prod+=dt;while(n.prod>=.9&&n.units<n.capacity){n.units++;n.prod-=.9}}if(n.type==='tower'&&n.owner!=='neutral'){n.towerClock-=dt;if(n.towerClock<=0&&towerShoot(n))n.towerClock=.42}}
  for(const o of state.orders){o.clock-=dt;const route=routeFor(o.from,o.to);while(o.remaining>0&&o.clock<=0){route.units.push({owner:o.owner,from:o.from,to:o.to,t:0});o.remaining--;o.clock+=.125}}
  state.orders=state.orders.filter(o=>o.remaining>0);
  for(const r of state.routes){for(const u of r.units)u.t+=dt/Math.max(1.7,3.2+Math.abs(state.nodes[r.a].x-state.nodes[r.b].x)*1.5);resolveRouteCombat(r);const arrived=r.units.filter(u=>u.t>=1);r.units=r.units.filter(u=>u.t<1);for(const u of arrived)arrive(u)}
  if(state.aiClock<=0){for(const f of state.level.factions)if(f!=='yellow')aiTurn(f);state.aiClock=Math.max(.65,1.65-state.level.id*.012)}
  checkEnd();timerEl.textContent=formatTime(state.time)}
function resolveRouteCombat(route){const forward=route.units.filter(u=>u.from===route.a).sort((a,b)=>b.t-a.t);const backward=route.units.filter(u=>u.from===route.b).sort((a,b)=>b.t-a.t);for(const a of forward){const b=backward.find(x=>x.owner!==a.owner&&x.t+a.t>=.96);if(b){a.dead=true;b.dead=true}}route.units=route.units.filter(u=>!u.dead)}
function towerShoot(tower){let best=null,bestD=Infinity;for(const r of state.routes){if(r.a!==tower.index&&r.b!==tower.index)continue;for(const u of r.units){if(u.owner===tower.owner)continue;const p=unitPosition(u,r),q=toScreen(tower),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<bestD){best={r,u};bestD=d}}}if(!best)return false;best.r.units.splice(best.r.units.indexOf(best.u),1);tower.flash=.12;return true}
function arrive(u){const n=state.nodes[u.to];if(n.owner===u.owner)n.units=Math.min(n.capacity,n.units+1);else{n.units--;if(n.units<0){n.owner=u.owner;n.units=0;n.prod=0;n.flash=.35}else if(n.units===0){n.owner='neutral';n.prod=0}}}
function aiTurn(owner){const mine=state.nodes.filter(n=>n.owner===owner&&n.units>=4);if(!mine.length)return;let best=null;for(const from of mine){for(const toIndex of connected(from.index)){const to=state.nodes[toIndex];let score=0;if(to.owner===owner)score=(to.units<22?28:0)+(to.type==='tower'?8:0)-to.units*.15;else{score=50-to.units*1.25+(to.owner==='neutral'?10:18)+(to.type==='hive'?12:18);if(owner==='red')score+=to.owner!=='neutral'?12:0;if(owner==='blue')score+=to.owner==='neutral'?18:0;if(owner==='purple')score+=to.units<12?24:0}score+=Math.random()*12;if(from.units<18)score-=28;if(!best||score>best.score)best={from:from.index,to:toIndex,score}}}if(best&&best.score>20)issueOrder(best.from,best.to,owner)}
function checkEnd(){const hostileStructures=state.nodes.some(n=>n.owner!=='yellow');const hostileTransit=state.routes.some(r=>r.units.some(u=>u.owner!=='yellow'))||state.orders.some(o=>o.owner!=='yellow');const yellowStructures=state.nodes.some(n=>n.owner==='yellow');const yellowTransit=state.routes.some(r=>r.units.some(u=>u.owner==='yellow'))||state.orders.some(o=>o.owner==='yellow');if(!hostileStructures&&!hostileTransit)endLevel(true);else if(!yellowStructures&&!yellowTransit)endLevel(false)}
function endLevel(win){state.ended=true;hud.classList.add('hidden');hint.classList.add('hidden');result.classList.remove('hidden');if(win){const seals=state.time<=state.level.expert?3:state.time<=state.level.par?2:1;progress.unlocked=Math.max(progress.unlocked,Math.min(59,state.level.id+1));progress.seals[state.level.id]=Math.max(progress.seals[state.level.id]||0,seals);progress.best[state.level.id]=Math.min(progress.best[state.level.id]??Infinity,state.time);saveProgress();resultEyebrow.textContent='BOARD SECURED';resultTitle.textContent='Victory';resultDetail.textContent=`${state.level.title} completed in ${formatTime(state.time)}.`;resultSeals.textContent='★'.repeat(seals)+'☆'.repeat(3-seals);nextButton.classList.toggle('hidden',state.level.id===59)}else{resultEyebrow.textContent='COLONY LOST';resultTitle.textContent='Defeat';resultDetail.textContent='Your last structure and every bee in transit were eliminated.';resultSeals.textContent='';nextButton.classList.add('hidden')}}

function draw(){ctx.clearRect(0,0,width,height);drawBoard();if(state){for(const r of state.routes)drawRoute(r);for(const r of state.routes)drawUnits(r);for(const n of state.nodes)drawNode(n);drawSelection()}}
function drawBoard(){ctx.fillStyle='#171a20';ctx.fillRect(0,0,width,height);const g=ctx.createRadialGradient(width*.5,height*.45,10,width*.5,height*.45,Math.max(width,height)*.7);g.addColorStop(0,'#2a303a');g.addColorStop(1,'#12151a');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);ctx.globalAlpha=.14;ctx.strokeStyle='#7d8796';ctx.lineWidth=1;const step=42;for(let x=(width%step)/2;x<width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}for(let y=(height%step)/2;y<height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}ctx.globalAlpha=1}
function drawRoute(r){const a=toScreen(state.nodes[r.a]),b=toScreen(state.nodes[r.b]);const active=pointer&&pointer.from!=null&&(r.a===pointer.from||r.b===pointer.from);ctx.strokeStyle=active?'#9b9270':'#49515d';ctx.lineWidth=active?5:3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#22262e';ctx.lineWidth=1;ctx.setLineDash([4,7]);ctx.stroke();ctx.setLineDash([])}
function drawUnits(r){for(const u of r.units){const p=unitPosition(u,r);ctx.fillStyle=FACTIONS[u.owner].color;ctx.beginPath();ctx.arc(p.x,p.y,4.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#11151b';ctx.lineWidth=1;ctx.stroke()}}
function drawNode(n){const p=toScreen(n),f=FACTIONS[n.owner],radius=n.type==='tower'?27:31;if(n.flash){n.flash=Math.max(0,n.flash-.016)}ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=n.flash?f.color:'rgba(0,0,0,.45)';ctx.shadowBlur=n.flash?28:14;ctx.fillStyle='#20252d';ctx.strokeStyle=f.color;ctx.lineWidth=4;if(n.type==='tower'){ctx.beginPath();for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,x=Math.cos(a)*radius,y=Math.sin(a)*radius;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}else{ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2)}ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=f.color;ctx.font=`800 ${n.type==='tower'?15:16}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.symbol,0,-9);ctx.fillStyle='#f7f3e7';ctx.font='900 17px system-ui';ctx.fillText(Math.max(0,n.units),0,11);if(n.index===keyboardNode){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,radius+8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}ctx.restore()}
function drawSelection(){if(!pointer||pointer.from==null)return;const from=toScreen(state.nodes[pointer.from]);ctx.strokeStyle=FACTIONS.yellow.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke()}
function nodeAt(x,y){let best=-1,d=44;for(const n of state.nodes){const p=toScreen(n),nd=Math.hypot(x-p.x,y-p.y);if(nd<d){d=nd;best=n.index}}return best}
function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('pointerdown',e=>{if(!state||state.ended||paused)return;canvas.setPointerCapture(e.pointerId);const p=pointerPos(e),i=nodeAt(p.x,p.y);if(i>=0&&state.nodes[i].owner==='yellow'){pointer={from:i,x:p.x,y:p.y,id:e.pointerId};keyboardNode=i}else if(pointer?.from!=null&&i>=0){issueOrder(pointer.from,i);pointer=null}});
canvas.addEventListener('pointermove',e=>{if(pointer&&e.pointerId===pointer.id)Object.assign(pointer,pointerPos(e))});
canvas.addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const p=pointerPos(e),i=nodeAt(p.x,p.y);if(i>=0&&i!==pointer.from)issueOrder(pointer.from,i);pointer=null});
canvas.addEventListener('pointercancel',()=>pointer=null);
addEventListener('keydown',e=>{if(!state||state.ended)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Enter','Escape'].includes(e.key))e.preventDefault();if(e.key==='Escape'){pointer=null;return}if(e.key==='Enter'){if(pointer?.from!=null){if(keyboardNode!==pointer.from)issueOrder(pointer.from,keyboardNode);pointer=null}else if(state.nodes[keyboardNode]?.owner==='yellow'){const p=toScreen(state.nodes[keyboardNode]);pointer={from:keyboardNode,x:p.x,y:p.y,id:'key'}}return}const dirs={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};const dir=dirs[e.key];if(dir){const pool=pointer?.from!=null?connected(pointer.from):state.nodes.map(n=>n.index);const cur=toScreen(state.nodes[keyboardNode]);let best=null;for(const i of pool){if(i===keyboardNode)continue;const p=toScreen(state.nodes[i]),dx=p.x-cur.x,dy=p.y-cur.y,dot=dx*dir[0]+dy*dir[1];if(dot<=0)continue;const score=Math.hypot(dx,dy)/(dot/Math.max(1,Math.hypot(dx,dy)));if(!best||score<best.score)best={i,score}}if(best)keyboardNode=best.i}});

document.addEventListener('visibilitychange',()=>{if(document.hidden&&state&&!state.ended){paused=true;pointer=null}});
continueButton.onclick=()=>startLevel(selectedLevel);retryButton.onclick=()=>startLevel(selectedLevel);nextButton.onclick=()=>startLevel(Math.min(59,selectedLevel+1));levelsButton.onclick=()=>{result.classList.add('hidden');menu.classList.remove('hidden');renderMenu()};
function formatTime(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return `${m}:${String(sec).padStart(2,'0')}`}
function frame(now){const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;update(dt);draw();raf=requestAnimationFrame(frame)}
renderMenu();frame(performance.now());
