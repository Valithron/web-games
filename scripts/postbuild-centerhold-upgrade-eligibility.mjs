import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');

function replaceRequired(needle, replacement, label) {
  if (!html.includes(needle)) throw new Error(`Centerhold upgrade balance target missing: ${label}`);
  html = html.replace(needle, replacement);
}

replaceRequired(
  `      function chooseUpgrades(count) {\n        return shuffle([...upgrades]).slice(0, count);\n      }`,
  `      function chooseUpgrades(count) {\n        const eligible = upgrades.filter(upgrade => upgrade.id !== 'multishot' || player.projectiles < 5);\n        return shuffle([...eligible]).slice(0, count);\n      }`,
  'chooseUpgrades'
);

replaceRequired(
  `        {\n          id: 'speed', name: 'Lighter boots', description: '+18% movement speed.',\n          apply: () => { player.speed *= 1.18; }\n        },`,
  `        {\n          id: 'speed', name: 'Run and Gun', description: '+15% movement speed. Fire 10% faster while moving.',\n          apply: () => {\n            player.speed *= 1.15;\n            player.runGunBonus += 0.10;\n          }\n        },`,
  'Run and Gun upgrade'
);

replaceRequired(
  `          fireCooldown: 0,\n          pierce: 0,`,
  `          fireCooldown: 0,\n          runGunBonus: 0,\n          isMoving: false,\n          pierce: 0,`,
  'Run and Gun player state'
);

replaceRequired(
  `        dx += touchMove.x;\n        dy += touchMove.y;\n\n        if (dx || dy) {`,
  `        dx += touchMove.x;\n        dy += touchMove.y;\n        player.isMoving = Boolean(dx || dy);\n\n        if (dx || dy) {`,
  'movement state tracking'
);

replaceRequired(
  `      function autoFire(dt) {\n        player.fireCooldown -= dt;`,
  `      function autoFire(dt) {\n        const runGunMultiplier = player.isMoving ? 1 + player.runGunBonus : 1;\n        player.fireCooldown -= dt * runGunMultiplier;`,
  'moving fire-rate bonus'
);

if (!html.includes("upgrade.id !== 'multishot' || player.projectiles < 5")) {
  throw new Error('Centerhold upgrade balance invariant failed: capped Split Fire can still appear');
}
if (!html.includes("name: 'Run and Gun'")) {
  throw new Error('Centerhold upgrade balance invariant failed: Run and Gun rename missing');
}
if (!html.includes('player.runGunBonus += 0.10')) {
  throw new Error('Centerhold upgrade balance invariant failed: Run and Gun fire-rate bonus missing');
}
if (!html.includes('player.fireCooldown -= dt * runGunMultiplier')) {
  throw new Error('Centerhold upgrade balance invariant failed: moving fire-rate application missing');
}

await writeFile(file, html);
console.log('Applied Centerhold upgrade eligibility and Run and Gun balance changes.');
