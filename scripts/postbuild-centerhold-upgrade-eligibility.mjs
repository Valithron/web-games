import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');

const needle = `      function chooseUpgrades(count) {\n        return shuffle([...upgrades]).slice(0, count);\n      }`;
const replacement = `      function chooseUpgrades(count) {\n        const eligible = upgrades.filter(upgrade => upgrade.id !== 'multishot' || player.projectiles < 5);\n        return shuffle([...eligible]).slice(0, count);\n      }`;

if (!html.includes(needle)) {
  throw new Error('Centerhold upgrade eligibility target missing: chooseUpgrades');
}

html = html.replace(needle, replacement);

if (!html.includes("upgrade.id !== 'multishot' || player.projectiles < 5")) {
  throw new Error('Centerhold upgrade eligibility invariant failed: capped Split Fire can still appear');
}

await writeFile(file, html);
console.log('Removed capped Split Fire from the Centerhold upgrade pool.');
