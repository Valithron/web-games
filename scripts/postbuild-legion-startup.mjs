import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const gamePath = path.join(ROOT, 'dist', 'legion-commander', 'game.js');
const htmlPath = path.join(ROOT, 'dist', 'legion-commander', 'index.html');

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Legion Commander patch target was not found: ${label}`);
  return source.replace(needle, replacement);
}

let game = await readFile(gamePath, 'utf8');

game = replaceOnce(
  game,
  "    apply(s) { s.levels.auxilia *= 1; }",
  "    apply(s) { s.levels.auxilia = Math.max(s.levels.auxilia + 1, s.purchases.auxilia || 1); }",
  'Auxilia level increment'
);

game = replaceOnce(
  game,
  "  const ac = initAudio();\n  if (!ac) return;",
  "  const ac = audio;\n  if (!ac) return;",
  'lazy tone audio lookup'
);

game = replaceOnce(
  game,
  "  lastFrame = performance.now();\n  initAudio();\n  call('Keep the Eagle moving. The legion will form around it.', 2.6);",
  "  lastFrame = performance.now();\n  call('Keep the Eagle moving. The legion will form around it.', 2.6);",
  'startup audio removal'
);

game = replaceOnce(
  game,
  `function formationSlot(index, total) {
  if (index === 0) return { x: 0, y: 24 };
  const golden = 2.399963229728653;
  const radius = 23 + Math.sqrt(index) * 13.5;
  const angle = index * golden;
  const crowd = clamp(total / 90, 0, 1);
  return {
    x: Math.cos(angle) * radius * (1 + crowd * .12),
    y: Math.sin(angle) * radius * .78
  };
}`,
  `function formationSlot(index, total) {
  const columns = clamp(Math.ceil(Math.sqrt(Math.max(1, total) * 1.35)), 4, 11);
  const row = Math.floor(index / columns);
  const rowStart = row * columns;
  const rowCount = Math.min(columns, total - rowStart);
  const col = index - rowStart;
  const rank = row % 2 === 0 ? -(Math.floor(row / 2) + 1) : Math.floor(row / 2) + 1;
  const spacingX = total > 80 ? 15 : 17;
  const spacingY = total > 80 ? 14 : 16;
  const stagger = Math.abs(rank) % 2 === 0 ? spacingX * .16 : 0;
  return {
    x: (col - (rowCount - 1) / 2) * spacingX + stagger,
    y: rank * spacingY
  };
}`,
  'ordered formation ranks'
);

game = replaceOnce(
  game,
  `function addSoldier(x, y) {
  soldiers.push({
    id: nextEntityId++, x, y, vx: 0, vy: 0,
    hp: state.soldierMaxHp, maxHp: state.soldierMaxHp,
    attack: rand(0, state.attackRate), flash: 0
  });
}`,
  `function addSoldier(x, y) {
  soldiers.push({
    id: nextEntityId++, x, y, vx: 0, vy: 0,
    hp: state.soldierMaxHp, maxHp: state.soldierMaxHp,
    attack: rand(0, state.attackRate), flash: 0,
    walkPhase: rand(0, TAU),
    strideRate: rand(6.2, 8.4),
    swayAmount: rand(.45, 1.15),
    marchBias: rand(.96, 1.05)
  });
}`,
  'individual march timing'
);

game = replaceOnce(
  game,
  `    const slot = formationSlot(i, total);
    const tx = state.eagle.x + slot.x;
    const ty = state.eagle.y + slot.y;
    const dx = tx - soldier.x;
    const dy = ty - soldier.y;
    const dist = Math.hypot(dx, dy) || 1;
    const catchup = Math.min(state.moveSpeed * 1.14 + dist * 2.5, 390);
    soldier.x += dx / dist * catchup * dt;
    soldier.y += dy / dist * catchup * dt;`,
  `    const slot = formationSlot(i, total);
    const baseTx = state.eagle.x + slot.x;
    const baseTy = state.eagle.y + slot.y;
    const formationDistance = Math.hypot(baseTx - soldier.x, baseTy - soldier.y);
    const marching = Math.hypot(input.axisX, input.axisY) > .08 || formationDistance > 4;
    soldier.walkPhase += dt * soldier.strideRate * (marching ? 1 : .18);
    const sway = Math.cos(soldier.walkPhase * .52 + soldier.id * .37) * soldier.swayAmount;
    const gait = Math.sin(soldier.walkPhase) * (marching ? .6 : .12);
    const tx = baseTx + sway;
    const ty = baseTy + gait;
    const dx = tx - soldier.x;
    const dy = ty - soldier.y;
    const dist = Math.hypot(dx, dy) || 1;
    const catchup = Math.min((state.moveSpeed * 1.12 + dist * 2.45) * soldier.marchBias, 390);
    soldier.x += dx / dist * catchup * dt;
    soldier.y += dy / dist * catchup * dt;`,
  'independent rank movement'
);

game = replaceOnce(
  game,
  `function drawSoldier(soldier) {
  const flash = soldier.flash > 0;
  ctx.save();
  ctx.translate(soldier.x, soldier.y);
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
}`,
  `function drawSoldier(soldier) {
  const flash = soldier.flash > 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const marching = status === 'playing' && Math.hypot(input.axisX, input.axisY) > .06;
  const bob = reduced ? 0 : Math.sin(soldier.walkPhase) * (marching ? 1.15 : .22);
  const step = reduced ? 0 : Math.sin(soldier.walkPhase) * (marching ? 2.1 : .25);
  const lean = reduced ? 0 : Math.sin(soldier.walkPhase * .5 + soldier.id) * .012;
  ctx.save();
  ctx.translate(soldier.x, soldier.y + bob);
  ctx.rotate(lean);
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
}`,
  'legionary walking bob'
);

game = replaceOnce(
  game,
  `function drawReinforcement(group) {
  const visible = Math.max(1, Math.min(8, group.count));
  ctx.save();
  ctx.translate(group.x, group.y);
  for (let i = 0; i < visible; i += 1) {
    const col = i % 3 - 1;
    const row = Math.floor(i / 3);
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
}`,
  `function drawReinforcement(group) {
  const visible = Math.max(1, Math.min(8, group.count));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const marchTime = performance.now() * .007;
  ctx.save();
  ctx.translate(group.x, group.y);
  for (let i = 0; i < visible; i += 1) {
    const col = i % 3 - 1;
    const row = Math.floor(i / 3);
    const phase = marchTime + group.id * .31 + i * .82;
    const bob = reduced ? 0 : Math.sin(phase) * 1.05;
    const step = reduced ? 0 : Math.sin(phase) * 1.5;
    ctx.fillStyle = '#4a2b22';
    ctx.fillRect(col * 10 - 2.5 + step * .25, row * 9 - 2 + bob, 1.5, 2.5);
    ctx.fillRect(col * 10 + .8 - step * .25, row * 9 - 2 + bob, 1.5, 2.5);
    ctx.fillStyle = group.flash > 0 ? '#fff0c9' : '#b24a3c';
    ctx.fillRect(col * 10 - 3.5, row * 9 - 9 + bob, 7, 7);
    ctx.fillStyle = '#d5c194';
    ctx.fillRect(col * 10 - 3.5, row * 9 - 11 + bob, 7, 2);
  }
  ctx.strokeStyle = '#efd16d';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(16, -16); ctx.lineTo(16, 16); ctx.stroke();
  ctx.fillStyle = '#b23830'; ctx.fillRect(16, -16, 15, 9);
  ctx.fillStyle = '#fff1bd'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(group.count), 0, 22);
  ctx.restore();
}`,
  'reinforcement walking bob'
);

game = replaceOnce(
  game,
  "ui.nextWaveButton.addEventListener('click', nextWave);",
  `ui.nextWaveButton.addEventListener('click', nextWave);\n\nconst primeAudioAfterStart = () => {\n  if (status !== 'playing' || muted || audio) return;\n  initAudio();\n};\naddEventListener('pointerdown', primeAudioAfterStart, { capture: true, passive: true });\naddEventListener('keydown', primeAudioAfterStart, { capture: true });`,
  'post-start audio priming'
);

await writeFile(gamePath, game);

let html = await readFile(htmlPath, 'utf8');
html = replaceOnce(
  html,
  './game.js?v=20260806-1',
  './game.js?v=20260806-3',
  'game script cache bust'
);
await writeFile(htmlPath, html);

console.log('Applied Legion Commander startup, upgrade, and formation polish patch.');
