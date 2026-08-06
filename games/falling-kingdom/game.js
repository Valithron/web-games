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
wave: document.querySelector('#waveValue'),
waveFill: document.querySelector('#waveFill'),
health: document.querySelector('#healthValue'),
people: document.querySelector('#peopleValue'),
food: document.querySelector('#foodValue'),
wood: document.querySelector('#woodValue'),
stone: document.querySelector('#stoneValue'),
coins: document.querySelector('#coinsValue'),
score: document.querySelector('#scoreValue')
};
const DROP_TYPES = {
villager: { good: true, color: '#e8d4a3', label: 'Villager', value: 190, size: 15 },
wood: { good: true, color: '#a87545', label: 'Wood', value: 70, size: 14 },
stone: { good: true, color: '#9aa1a5', label: 'Stone', value: 75, size: 14 },
food: { good: true, color: '#d18b50', label: 'Food', value: 85, size: 14 },
coin: { good: true, color: '#edc95f', label: 'Coins', value: 120, size: 12 },
animal: { good: true, color: '#eee5cf', label: 'Goat', value: 145, size: 14 },
boulder: { good: false, color: '#63676f', label: 'Boulder', damage: 18, size: 20 },
fire: { good: false, color: '#ef7d48', label: 'Fireball', damage: 13, size: 17 },
raider: { good: false, color: '#b14f4f', label: 'Raider', damage: 10, size: 16 },
curse: { good: false, color: '#9a6ac0', label: 'Cursed Idol', damage: 7, size: 15 }
};
const BUILDINGS = {
farm: { name: 'Farm', color: '#8eaf63' },
tower: { name: 'Watchtower', color: '#9a7655' },
wall: { name: 'Stone Wall', color: '#858b91' },
market: { name: 'Market', color: '#b98655' },
brigade: { name: 'Fire Brigade', color: '#b85d4e' },
temple: { name: 'Temple', color: '#b8b0d6' },
barracks: { name: 'Barracks', color: '#985c4e' },
storehouse: { name: 'Storehouse', color: '#ad885b' }
};
const UPGRADE_POOL = [
{
key: 'farm', resource: 'wood', baseCost: 6, growth: 4, max: 6,
title: 'Build Farm', desc: 'Produce 1.2 food per second.',
level: s => s.buildings.farm,
apply: s => { s.buildings.farm += 1; }
},
{
key: 'market', resource: 'wood', baseCost: 8, growth: 5, max: 5,
title: 'Open Market', desc: 'Generate coins and passive score.',
level: s => s.buildings.market,
apply: s => { s.buildings.market += 1; }
},
{
key: 'brigade', resource: 'wood', baseCost: 10, growth: 6, max: 3,
title: 'Train Fire Brigade', desc: 'Each brigade further reduces fire damage.',
level: s => s.buildings.brigade,
apply: s => { s.buildings.brigade += 1; }
},
{
key: 'barracks', resource: 'wood', baseCost: 9, growth: 5, max: 4,
title: 'Build Barracks', desc: 'Guards reduce raider damage and abductions.',
level: s => s.buildings.barracks,
apply: s => { s.buildings.barracks += 1; }
},
{
key: 'storehouse', resource: 'wood', baseCost: 8, growth: 6, max: 4,
title: 'Expand Storehouse', desc: 'Caught resources and their score are worth 25% more.',
level: s => s.buildings.storehouse,
apply: s => { s.buildings.storehouse += 1; }
},
{
key: 'tower', resource: 'stone', baseCost: 6, growth: 4, max: 6,
title: 'Raise Watchtower', desc: 'Automatically shoot more falling hazards.',
level: s => s.buildings.tower,
apply: s => { s.buildings.tower += 1; }
},
{
key: 'wall', resource: 'stone', baseCost: 8, growth: 6, max: 5,
title: 'Fortify Walls', desc: 'Gain 28 maximum keep health and a wider catch platform.',
level: s => s.buildings.wall,
apply: s => {
s.buildings.wall += 1;
s.maxHealth += 28;
s.health = Math.min(s.maxHealth, s.health + 28);
}
},
{
key: 'temple', resource: 'stone', baseCost: 10, growth: 6, max: 4,
title: 'Build Temple', desc: 'Repair the keep and weaken cursed idols.',
level: s => s.buildings.temple,
apply: s => { s.buildings.temple += 1; }
},
{
key: 'speed', resource: 'coins', baseCost: 6, growth: 5, max: 5,
title: 'Royal Wheels', desc: 'Increase kingdom movement speed by 18%.',
level: s => s.levels.speed,
apply: s => { s.levels.speed += 1; s.speed *= 1.18; }
},
{
key: 'shield', resource: 'coins', baseCost: 7, growth: 6, max: 5,
title: 'Charged Crown', desc: 'Recharge the royal shield 25% faster.',
level: s => s.levels.shield,
apply: s => { s.levels.shield += 1; s.shieldRate *= 1.25; }
},
{
key: 'people', resource: 'coins', baseCost: 10, growth: 7, max: 4,
title: 'Refugee Quarter', desc: 'Immediately welcome three villagers.',
level: s => s.levels.people,
apply: s => {
s.levels.people += 1;
s.people += 3;
for (let i = 0; i < 3; i += 1) spawnVillager();
}
},
{
key: 'supplies', resource: 'coins', baseCost: 8, growth: 6, max: 5,
title: 'Royal Supply Caravan', desc: 'Trade coins for wood, stone, and food.',
level: s => s.levels.supplies,
apply: s => {
s.levels.supplies += 1;
const bonus = 8 + s.levels.supplies * 2;
s.wood += bonus;
s.stone += bonus;
s.food += bonus + 6;
}
},
{
key: 'repair', resource: 'coins', baseCost: 5, growth: 0, max: Infinity,
title: 'Royal Repairs', desc: 'Restore 35 keep health immediately.',
level: () => 0,
available: s => s.health < s.maxHealth - 8,
apply: s => { s.health = Math.min(s.maxHealth, s.health + 35); }
}
];
let width = 0;
let height = 0;
let dpr = 1;
let status = 'menu';
let paused = false;
let previousStatus = 'menu';
let last = performance.now();
let drops = [];
let particles = [];
let floaters = [];
let villagers = [];
let shots = [];
let state = null;
const keys = new Set();
let steerPointer = null;
let steerX = 0;
let touchTargetX = null;
let audio = null;
let muted = false;
let toastTime = 0;
function freshState() {
return {
wave: 1,
waveTime: 0,
waveLength: 43,
score: 0,
health: 100,
maxHealth: 100,
people: 2,
animals: 0,
food: 12,
wood: 5,
stone: 3,
coins: 0,
speed: 285,
shield: 1,
shieldActive: 0,
shieldRate: .055,
spawn: 0,
production: 0,
shot: 0,
platformX: .5,
buildings: {
farm: 0,
tower: 0,
wall: 0,
market: 0,
brigade: 0,
temple: 0,
barracks: 0,
storehouse: 0
},
levels: { speed: 0, shield: 0, people: 0, supplies: 0 },
ended: false
};
}
function safeBest() {
try { return Number(localStorage.getItem('escapee:falling-kingdom:best')) || 0; }
catch { return 0; }
}
function saveBest(value) {
try { localStorage.setItem('escapee:falling-kingdom:best', String(value)); }
catch {}
}
function initAudio() {
if (audio || muted) return;
try {
audio = new (window.AudioContext || window.webkitAudioContext)();
audio.resume?.().catch(() => {});
} catch { audio = null; }
}
function tone(frequency = 360, duration = .07, type = 'triangle', volume = .04) {
if (muted) return;
initAudio();
if (!audio) return;
try {
const oscillator = audio.createOscillator();
const gain = audio.createGain();
oscillator.type = type;
oscillator.frequency.value = frequency;
gain.gain.setValueAtTime(volume, audio.currentTime);
gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
oscillator.connect(gain);
gain.connect(audio.destination);
oscillator.start();
oscillator.stop(audio.currentTime + duration);
} catch {}
}
function toggleMuted() {
muted = !muted;
if (!muted) tone(440, .05);
showToast(muted ? 'Sound off' : 'Sound on');
}
function resize() {
const rect = canvas.getBoundingClientRect();
width = Math.max(1, rect.width);
height = Math.max(1, rect.height);
dpr = Math.min(devicePixelRatio || 1, 2);
canvas.width = Math.round(width * dpr);
canvas.height = Math.round(height * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function platformWidth() {
return Math.min(width * .72, 150 + state.buildings.wall * 26 + Math.floor(state.people) * 2.2);
}
function platformY() {
return height - Math.max(82, Math.min(126, height * .18));
}
function platformLeft() {
return state.platformX * width - platformWidth() / 2;
}
function showToast(text, seconds = 1.4) {
toast.textContent = text;
toast.classList.add('visible');
toastTime = seconds;
}
function addParticles(x, y, color, count = 9) {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const total = reduced ? Math.ceil(count / 3) : count;
for (let i = 0; i < total; i += 1) {
particles.push({
x,
y,
vx: (Math.random() - .5) * 150,
vy: (Math.random() - .7) * 150,
life: .45 + Math.random() * .35,
color,
size: 2 + Math.random() * 4
});
}
}
function floater(x, y, text, color = '#fff1bd') {
floaters.push({ x, y, text, color, life: 1 });
}
function clearInputs() {
keys.clear();
steerPointer = null;
steerX = 0;
touchTargetX = null;
shieldButton.classList.remove('active');
}
function resetGame() {
state = freshState();
drops = [];
particles = [];
floaters = [];
shots = [];
villagers = [];
for (let i = 0; i < state.people; i += 1) spawnVillager(i);
status = 'playing';
previousStatus = 'playing';
paused = false;
startOverlay.hidden = true;
upgradeOverlay.hidden = true;
endOverlay.hidden = true;
clearInputs();
last = performance.now();
initAudio();
tone(310, .1);
showToast('Catch supplies. Spend them after the wave.');
}
function spawnVillager(index = 0) {
villagers.push({
x: .35 + Math.random() * .3,
y: 0,
tx: .2 + Math.random() * .6,
speed: .12 + Math.random() * .09,
phase: index + Math.random() * 8,
carrying: Math.random() < .25
});
}
function weightedDrop() {
const wave = state.wave;
const pool = ['wood', 'wood', 'food', 'food', 'stone', 'stone', 'villager', 'coin', 'animal', 'boulder'];
if (wave > 1) pool.push('coin', 'fire');
if (wave > 2) pool.push('raider');
if (wave > 3) pool.push('curse', 'boulder');
if (state.food < Math.max(7, state.people * 1.5)) pool.push('food', 'food');
if (state.wood < 8) pool.push('wood');
if (state.stone < 7) pool.push('stone');
return pool[Math.floor(Math.random() * pool.length)];
}
function spawnDrop() {
const type = weightedDrop();
const def = DROP_TYPES[type];
drops.push({
type,
x: 24 + Math.random() * Math.max(1, width - 48),
y: -30,
vy: 88 + state.wave * 13 + Math.random() * 60,
vx: (Math.random() - .5) * 24,
rot: Math.random() * Math.PI * 2,
spin: (Math.random() - .5) * 2.2,
size: def.size,
dead: false
});
}
function activateShield() {
if (status !== 'playing' || state.shield < .999 || state.shieldActive > 0) return;
state.shield = 0;
state.shieldActive = 4.2;
shieldButton.classList.add('active');
showToast('Royal shield raised');
tone(620, .18, 'sine', .05);
}
function catchDrop(drop) {
const def = DROP_TYPES[drop.type];
const resourceMult = 1 + state.buildings.storehouse * .25;
if (def.good) {
let message = def.label;
let amount = 0;
switch (drop.type) {
case 'villager':
state.people += 1;
spawnVillager();
message = 'Villager rescued';
break;
case 'wood':
amount = Math.max(1, Math.round(3 * resourceMult));
state.wood += amount;
message = `+${amount} wood`;
break;
case 'stone':
amount = Math.max(1, Math.round(3 * resourceMult));
state.stone += amount;
message = `+${amount} stone`;
break;
case 'food':
amount = Math.max(1, Math.round(5 * resourceMult));
state.food += amount;
message = `+${amount} food`;
break;
case 'coin':
amount = Math.max(1, Math.round(4 * resourceMult));
state.coins += amount;
message = `+${amount} coins`;
break;
case 'animal':
state.animals += 1;
state.food += 2;
message = 'Goat joined the kingdom';
break;
}
const gain = Math.round(def.value * resourceMult);
state.score += gain;
floater(drop.x, platformY() - 18, message, def.color);
tone(drop.type === 'villager' ? 600 : 430, .07);
addParticles(drop.x, platformY(), def.color, 10);
} else {
let damage = def.damage;
if (drop.type === 'fire') damage *= Math.pow(.66, state.buildings.brigade);
if (drop.type === 'raider') damage *= Math.pow(.63, state.buildings.barracks);
if (drop.type === 'curse') damage *= Math.pow(.68, state.buildings.temple);
if (state.shieldActive > 0) {
state.score += 60;
floater(drop.x, platformY() - 18, 'BLOCKED', '#bda8ff');
tone(760, .05);
addParticles(drop.x, platformY(), '#bda8ff', 12);
} else {
state.health -= damage;
floater(drop.x, platformY() - 18, `-${Math.ceil(damage)} keep`, '#ff8d78');
tone(100, .12, 'sawtooth');
addParticles(drop.x, platformY(), def.color, 14);
if (drop.type === 'fire') showToast('Fire in the kingdom');
if (drop.type === 'raider' && state.people > 0 && Math.random() < Math.max(.08, .38 - state.buildings.barracks * .09)) {
state.people = Math.max(0, state.people - 1);
showToast('A villager was taken');
}
}
}
drop.dead = true;
}
function updateProduction(dt) {
state.production += dt;
if (state.production < 1) return;
state.production -= 1;
const workers = Math.max(0, Math.floor(state.people));
state.food += state.buildings.farm * 1.2 + state.animals * .18;
if (state.buildings.market) {
state.coins += state.buildings.market * .45;
state.score += state.buildings.market * 10;
}
if (state.buildings.temple) {
state.health = Math.min(state.maxHealth, state.health + state.buildings.temple * .5);
}
state.food -= Math.max(.08, workers * .055);
if (state.food < 0) {
state.food = 0;
state.health -= .65;
}
while (villagers.length < Math.floor(state.people)) spawnVillager(villagers.length);
while (villagers.length > Math.ceil(state.people)) villagers.pop();
}
function updateTowers(dt) {
state.shot -= dt;
if (state.buildings.tower <= 0 || state.shot > 0) return;
const target = drops
.filter(drop => !drop.dead && !DROP_TYPES[drop.type].good && drop.y > 30)
.sort((a, b) => b.y - a.y)[0];
if (!target) return;
state.shot = Math.max(.28, 1.05 - state.buildings.tower * .13);
shots.push({ x: state.platformX * width, y: platformY() - 46, tx: target.x, ty: target.y, life: .18 });
tone(540, .035, 'square', .018);
if (Math.random() < Math.min(.88, .34 + state.buildings.tower * .1)) {
target.dead = true;
state.score += 90;
addParticles(target.x, target.y, '#f4d27b', 8);
floater(target.x, target.y, 'SHOT', '#f4d27b');
}
}
function updateVillagers(dt) {
for (const villager of villagers) {
villager.x += (villager.tx - villager.x) * dt * villager.speed;
if (Math.abs(villager.tx - villager.x) < .03) villager.tx = .12 + Math.random() * .76;
villager.phase += dt * (2 + villager.speed * 4);
if (Math.random() < dt * .035) villager.carrying = !villager.carrying;
}
}
function upgradeCost(upgrade) {
return Math.ceil(upgrade.baseCost + upgrade.growth * upgrade.level(state));
}
function canOffer(upgrade) {
const level = upgrade.level(state);
if (level >= upgrade.max) return false;
if (upgrade.available && !upgrade.available(state)) return false;
return state[upgrade.resource] >= upgradeCost(upgrade);
}
function shuffled(items) {
const copy = [...items];
for (let i = copy.length - 1; i > 0; i -= 1) {
const j = Math.floor(Math.random() * (i + 1));
[copy[i], copy[j]] = [copy[j], copy[i]];
}
return copy;
}
function chooseAffordableUpgrades() {
const affordable = UPGRADE_POOL.filter(canOffer);
const choices = [];
for (const resource of ['wood', 'stone', 'coins']) {
const group = shuffled(affordable.filter(upgrade => upgrade.resource === resource));
if (group.length) choices.push(group[0]);
}
for (const upgrade of shuffled(affordable)) {
if (choices.length >= 3) break;
if (!choices.includes(upgrade)) choices.push(upgrade);
}
return choices.slice(0, 3);
}
function beginNextWave() {
state.wave += 1;
state.waveTime = 0;
state.waveLength = Math.min(55, state.waveLength + 1.5);
state.health = Math.min(state.maxHealth, state.health + 8);
state.spawn = .25;
drops = [];
status = 'playing';
previousStatus = 'playing';
upgradeOverlay.hidden = true;
last = performance.now();
tone(470, .09);
showToast(`Wave ${state.wave} begins`);
}
function purchaseUpgrade(upgrade, cost) {
if (state[upgrade.resource] < cost) return;
state[upgrade.resource] -= cost;
upgrade.apply(state);
showToast(`${upgrade.title}: -${cost} ${upgrade.resource}`);
beginNextWave();
}
function completeWave() {
status = 'between-rounds';
previousStatus = status;
clearInputs();
drops = [];
state.score += Math.round(state.health * 4 + state.people * 70);
document.querySelector('#waveComplete').textContent = `Wave ${state.wave} survived`;
document.querySelector('#waveSummary').textContent =
`${Math.floor(state.people)} villagers · ${Math.floor(state.wood)} wood · ${Math.floor(state.stone)} stone · ${Math.floor(state.coins)} coins. Only affordable projects are offered.`;
const choices = chooseAffordableUpgrades();
upgradeGrid.replaceChildren();
for (const upgrade of choices) {
const cost = upgradeCost(upgrade);
const button = document.createElement('button');
button.type = 'button';
button.className = `upgrade resource-${upgrade.resource}`;
button.innerHTML = `<strong>${upgrade.title}</strong><span>${upgrade.desc}</span><em>${cost} ${upgrade.resource}</em>`;
button.addEventListener('click', () => purchaseUpgrade(upgrade, cost), { once: true });
upgradeGrid.append(button);
}
if (choices.length < 3) {
const save = document.createElement('button');
save.type = 'button';
save.className = 'upgrade save-resources';
save.innerHTML = '<strong>Bank Resources</strong><span>Buy nothing this wave and keep saving for a stronger project.</span><em>NO COST</em>';
save.addEventListener('click', beginNextWave, { once: true });
upgradeGrid.append(save);
}
upgradeOverlay.hidden = false;
upgradeGrid.querySelector('button')?.focus();
}
function endGame() {
if (state.ended) return;
state.ended = true;
status = 'game-over';
clearInputs();
const final = Math.max(0, Math.floor(state.score));
const previousBest = safeBest();
const best = Math.max(final, previousBest);
if (best > previousBest) saveBest(best);
document.querySelector('#finalScore').textContent = final.toLocaleString();
document.querySelector('#bestScore').textContent = best.toLocaleString();
document.querySelector('#endSummary').textContent =
`The kingdom reached wave ${state.wave} with ${Math.floor(state.people)} villagers, ${state.animals} animals, and ${Object.values(state.buildings).reduce((sum, level) => sum + level, 0)} buildings.`;
endOverlay.hidden = false;
tone(120, .32, 'sawtooth', .055);
window.EscapeeScores?.submit(final, {
label: 'Kingdom score',
display: `${final.toLocaleString()} pts · Wave ${state.wave}`
});
}
function update(dt) {
if (status !== 'playing' || paused) return;
state.waveTime += dt;
state.spawn -= dt;
toastTime -= dt;
if (toastTime <= 0) toast.classList.remove('visible');
const keyboardAxis =
Number(keys.has('KeyD') || keys.has('ArrowRight')) -
Number(keys.has('KeyA') || keys.has('ArrowLeft'));
if (touchTargetX !== null) {
const current = state.platformX * width;
const difference = touchTargetX - current;
steerX = Math.max(-1, Math.min(1, difference / 70));
if (Math.abs(difference) < 5) touchTargetX = null;
} else {
steerX = keyboardAxis;
}
const halfPlatform = platformWidth() / 2 / width;
state.platformX = Math.max(
halfPlatform,
Math.min(1 - halfPlatform, state.platformX + steerX * state.speed / width * dt)
);
if (keys.has('Space') || keys.has('Enter')) activateShield();
state.shield = Math.min(1, state.shield + state.shieldRate * dt);
state.shieldActive = Math.max(0, state.shieldActive - dt);
shieldButton.classList.toggle('active', state.shieldActive > 0);
shieldButton.classList.toggle('cooldown', state.shield < .999 && state.shieldActive <= 0);
shieldLabel.textContent = state.shieldActive > 0
? 'Active'
: state.shield >= .999
? 'Ready'
: `${Math.floor(state.shield * 100)}%`;
const spawnInterval = Math.max(.24, .78 - state.wave * .035);
if (state.spawn <= 0) {
spawnDrop();
state.spawn = spawnInterval * (.75 + Math.random() * .5);
}
const catchLeft = platformLeft();
const catchRight = catchLeft + platformWidth();
const catchY = platformY();
for (const drop of drops) {
if (drop.dead) continue;
drop.x += drop.vx * dt;
drop.y += drop.vy * dt;
drop.rot += drop.spin * dt;
if (drop.x < drop.size || drop.x > width - drop.size) {
drop.vx *= -1;
drop.x = Math.max(drop.size, Math.min(width - drop.size, drop.x));
}
if (drop.y + drop.size >= catchY && drop.y - drop.size <= catchY + 30 && drop.x >= catchLeft && drop.x <= catchRight) {
catchDrop(drop);
} else if (drop.y - drop.size > height + 20) {
if (DROP_TYPES[drop.type].good) {
state.score = Math.max(0, state.score - 12);
}
drop.dead = true;
}
}
drops = drops.filter(drop => !drop.dead);
updateProduction(dt);
updateTowers(dt);
updateVillagers(dt);
for (const particle of particles) {
particle.x += particle.vx * dt;
particle.y += particle.vy * dt;
particle.vx *= .96;
particle.vy += 80 * dt;
particle.life -= dt;
}
particles = particles.filter(particle => particle.life > 0);
for (const item of floaters) {
item.y -= 28 * dt;
item.life -= dt;
}
floaters = floaters.filter(item => item.life > 0);
for (const shot of shots) shot.life -= dt;
shots = shots.filter(shot => shot.life > 0);
if (state.health <= 0 || state.people <= 0) {
state.health = Math.max(0, state.health);
state.people = Math.max(0, state.people);
endGame();
return;
}
if (state.waveTime >= state.waveLength) completeWave();
}
function roundedRect(x, y, w, h, radius) {
ctx.beginPath();
ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
}
function drawBackground() {
const gradient = ctx.createLinearGradient(0, 0, 0, height);
gradient.addColorStop(0, '#162840');
gradient.addColorStop(.6, '#42546a');
gradient.addColorStop(1, '#76634d');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);
const cloudY = Math.max(80, height * .18);
ctx.fillStyle = 'rgba(235,239,235,.09)';
for (let i = 0; i < 7; i += 1) {
const x = ((i * 173 + state.waveTime * (5 + i)) % (width + 180)) - 90;
const y = cloudY + (i % 3) * 48;
ctx.beginPath();
ctx.ellipse(x, y, 80 + (i % 2) * 24, 22, 0, 0, Math.PI * 2);
ctx.fill();
}
ctx.fillStyle = 'rgba(25,27,29,.28)';
const ridge = platformY() + 34;
ctx.beginPath();
ctx.moveTo(0, ridge);
for (let x = 0; x <= width; x += 60) {
ctx.lineTo(x, ridge - 25 - Math.sin(x * .023) * 18);
}
ctx.lineTo(width, height);
ctx.lineTo(0, height);
ctx.closePath();
ctx.fill();
}
function drawDrop(drop) {
const def = DROP_TYPES[drop.type];
ctx.save();
ctx.translate(drop.x, drop.y);
ctx.rotate(drop.rot);
ctx.lineWidth = 2;
ctx.strokeStyle = 'rgba(20,20,20,.5)';
if (drop.type === 'wood') {
ctx.fillStyle = def.color;
roundedRect(-16, -9, 32, 18, 5);
ctx.fill();
ctx.stroke();
ctx.strokeStyle = '#6b4326';
ctx.beginPath();
ctx.moveTo(-9, -6);
ctx.lineTo(8, 6);
ctx.stroke();
} else if (drop.type === 'stone' || drop.type === 'boulder') {
ctx.fillStyle = def.color;
ctx.beginPath();
ctx.moveTo(-drop.size, 2);
ctx.lineTo(-drop.size * .55, -drop.size * .8);
ctx.lineTo(drop.size * .45, -drop.size);
ctx.lineTo(drop.size, -2);
ctx.lineTo(drop.size * .55, drop.size * .85);
ctx.lineTo(-drop.size * .5, drop.size);
ctx.closePath();
ctx.fill();
ctx.stroke();
} else if (drop.type === 'food') {
ctx.fillStyle = '#c7753f';
ctx.beginPath();
ctx.arc(0, 2, 13, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#7da05d';
ctx.fillRect(-2, -15, 5, 8);
} else if (drop.type === 'coin') {
ctx.fillStyle = def.color;
ctx.beginPath();
ctx.arc(0, 0, 12, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#8a6927';
ctx.font = '900 13px system-ui';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('$', 0, 1);
} else if (drop.type === 'villager') {
ctx.fillStyle = '#d9b58d';
ctx.beginPath();
ctx.arc(0, -6, 7, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#6f866c';
roundedRect(-8, 1, 16, 19, 5);
ctx.fill();
} else if (drop.type === 'animal') {
ctx.fillStyle = def.color;
ctx.beginPath();
ctx.ellipse(0, 3, 15, 10, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#4b4138';
ctx.beginPath();
ctx.arc(12, -3, 6, 0, Math.PI * 2);
ctx.fill();
} else if (drop.type === 'fire') {
const fire = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
fire.addColorStop(0, '#fff0a1');
fire.addColorStop(.45, '#ef7d48');
fire.addColorStop(1, 'rgba(181,48,39,0)');
ctx.fillStyle = fire;
ctx.beginPath();
ctx.arc(0, 0, 20, 0, Math.PI * 2);
ctx.fill();
} else if (drop.type === 'raider') {
ctx.fillStyle = def.color;
ctx.beginPath();
ctx.moveTo(0, -17);
ctx.lineTo(14, 14);
ctx.lineTo(-14, 14);
ctx.closePath();
ctx.fill();
ctx.fillStyle = '#261e1e';
ctx.fillRect(-7, -4, 14, 5);
} else if (drop.type === 'curse') {
ctx.fillStyle = def.color;
ctx.beginPath();
ctx.moveTo(0, -17);
ctx.lineTo(14, -2);
ctx.lineTo(8, 16);
ctx.lineTo(-8, 16);
ctx.lineTo(-14, -2);
ctx.closePath();
ctx.fill();
ctx.fillStyle = '#e9d7ff';
ctx.beginPath();
ctx.arc(0, 0, 3, 0, Math.PI * 2);
ctx.fill();
}
ctx.restore();
}
function drawBuilding(type, level, x, groundY, scale = 1) {
if (level <= 0) return;
const def = BUILDINGS[type];
const w = 24 * scale;
const h = (20 + Math.min(3, level) * 5) * scale;
ctx.fillStyle = 'rgba(0,0,0,.2)';
roundedRect(x - w / 2 + 3, groundY - h + 4, w, h, 4);
ctx.fill();
ctx.fillStyle = def.color;
roundedRect(x - w / 2, groundY - h, w, h, 4);
ctx.fill();
ctx.fillStyle = '#d9c18c';
ctx.beginPath();
ctx.moveTo(x - w * .62, groundY - h);
ctx.lineTo(x, groundY - h - 9 * scale);
ctx.lineTo(x + w * .62, groundY - h);
ctx.closePath();
ctx.fill();
ctx.fillStyle = '#f5cf72';
ctx.fillRect(x - 3 * scale, groundY - 11 * scale, 6 * scale, 8 * scale);
}
function drawKingdom() {
const y = platformY();
const left = platformLeft();
const w = platformWidth();
const center = state.platformX * width;
ctx.fillStyle = 'rgba(0,0,0,.28)';
ctx.beginPath();
ctx.ellipse(center, y + 31, w * .52, 20, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#6d543e';
roundedRect(left, y, w, 31, 10);
ctx.fill();
ctx.fillStyle = '#94714e';
roundedRect(left + 6, y - 7, w - 12, 18, 7);
ctx.fill();
ctx.strokeStyle = '#d8bd87';
ctx.lineWidth = 2;
ctx.stroke();
const ground = y - 7;
const slots = [
['farm', -.38], ['market', -.27], ['storehouse', -.16], ['barracks', -.06],
['brigade', .09], ['temple', .2], ['tower', .31], ['wall', .4]
];
for (const [type, offset] of slots) {
drawBuilding(type, state.buildings[type], center + w * offset, ground, width < 480 ? .78 : 1);
}
const keepW = 42 + Math.min(3, state.buildings.wall) * 4;
const keepH = 48;
ctx.fillStyle = '#b5a78e';
roundedRect(center - keepW / 2, ground - keepH, keepW, keepH, 5);
ctx.fill();
ctx.fillStyle = '#6c7280';
ctx.fillRect(center - keepW / 2 - 5, ground - keepH - 8, keepW + 10, 11);
ctx.fillStyle = '#f3cf6d';
ctx.fillRect(center - 5, ground - 22, 10, 15);
ctx.strokeStyle = '#e7c65f';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(center, ground - keepH - 8);
ctx.lineTo(center, ground - keepH - 31);
ctx.stroke();
ctx.fillStyle = '#8e3e45';
ctx.beginPath();
ctx.moveTo(center, ground - keepH - 31);
ctx.lineTo(center + 20, ground - keepH - 24);
ctx.lineTo(center, ground - keepH - 17);
ctx.closePath();
ctx.fill();
const innerLeft = left + 18;
const innerWidth = Math.max(1, w - 36);
for (const villager of villagers) {
const vx = innerLeft + villager.x * innerWidth;
const bob = Math.sin(villager.phase) * 1.5;
ctx.fillStyle = '#d7ae84';
ctx.beginPath();
ctx.arc(vx, ground - 13 + bob, 3.5, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = villager.carrying ? '#d3a85d' : '#6f866c';
ctx.fillRect(vx - 3, ground - 9 + bob, 6, 8);
if (villager.carrying) {
ctx.fillStyle = '#9b6d3f';
ctx.fillRect(vx + 3, ground - 8 + bob, 4, 4);
}
}
if (state.shieldActive > 0) {
ctx.strokeStyle = `rgba(190,174,255,${.55 + Math.sin(performance.now() * .012) * .15})`;
ctx.lineWidth = 5;
ctx.beginPath();
ctx.ellipse(center, ground - 24, w * .56, 70, 0, Math.PI, Math.PI * 2);
ctx.stroke();
}
}
function drawEffects() {
for (const shot of shots) {
ctx.globalAlpha = Math.max(0, shot.life / .18);
ctx.strokeStyle = '#f6d57c';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(shot.x, shot.y);
ctx.lineTo(shot.tx, shot.ty);
ctx.stroke();
}
ctx.globalAlpha = 1;
for (const particle of particles) {
ctx.globalAlpha = Math.max(0, particle.life / .8);
ctx.fillStyle = particle.color;
ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
}
ctx.globalAlpha = 1;
ctx.textAlign = 'center';
ctx.font = '900 12px system-ui';
for (const item of floaters) {
ctx.globalAlpha = Math.max(0, item.life);
ctx.fillStyle = item.color;
ctx.fillText(item.text, item.x, item.y);
}
ctx.globalAlpha = 1;
}
function updateHud() {
hud.wave.textContent = String(state.wave);
hud.waveFill.style.transform = `scaleX(${Math.max(0, Math.min(1, state.waveTime / state.waveLength))})`;
hud.health.textContent = `${Math.ceil(state.health)}/${state.maxHealth}`;
hud.people.textContent = String(Math.floor(state.people));
hud.food.textContent = String(Math.floor(state.food));
hud.wood.textContent = String(Math.floor(state.wood));
hud.stone.textContent = String(Math.floor(state.stone));
hud.coins.textContent = String(Math.floor(state.coins));
hud.score.textContent = Math.floor(state.score).toLocaleString();
}
function draw() {
drawBackground();
for (const drop of drops) drawDrop(drop);
drawKingdom();
drawEffects();
updateHud();
}
function frame(now) {
const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
last = now;
update(dt);
draw();
requestAnimationFrame(frame);
}
function onKeyDown(event) {
if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
event.preventDefault();
keys.add(event.code);
}
}
function onKeyUp(event) {
keys.delete(event.code);
}
function setTouchTarget(event) {
touchTargetX = Math.max(0, Math.min(width, event.clientX));
}
steerZone.addEventListener('pointerdown', event => {
event.preventDefault();
steerPointer = event.pointerId;
steerZone.setPointerCapture?.(event.pointerId);
setTouchTarget(event);
initAudio();
});
steerZone.addEventListener('pointermove', event => {
if (event.pointerId === steerPointer) setTouchTarget(event);
});
const releaseSteer = event => {
if (steerPointer !== null && (!event || event.pointerId === steerPointer)) {
steerPointer = null;
touchTargetX = null;
steerX = 0;
}
};
steerZone.addEventListener('pointerup', releaseSteer);
steerZone.addEventListener('pointercancel', releaseSteer);
steerZone.addEventListener('lostpointercapture', releaseSteer);
shieldButton.addEventListener('pointerdown', event => {
event.preventDefault();
shieldButton.setPointerCapture?.(event.pointerId);
activateShield();
initAudio();
});
document.querySelector('#startButton').addEventListener('click', resetGame);
document.querySelector('#restartButton').addEventListener('click', resetGame);
document.querySelector('#soundBtn').addEventListener('click', toggleMuted);
addEventListener('keydown', onKeyDown, { passive: false });
addEventListener('keyup', onKeyUp);
addEventListener('blur', clearInputs);
addEventListener('pagehide', clearInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInputs(); });
addEventListener('escapee:pause', clearInputs);
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 90));
window.EscapeeGame = {
restart: resetGame,
pause() {
if (status === 'playing' || status === 'between-rounds') {
previousStatus = status;
paused = true;
status = 'paused';
clearInputs();
}
},
resume() {
if (status === 'paused') {
status = previousStatus === 'between-rounds' ? 'between-rounds' : 'playing';
paused = false;
last = performance.now();
}
},
setMuted() {},
getStatus: () => status
};
state = freshState();
resize();
draw();
requestAnimationFrame(frame);
})();
