import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Centerhold progression patch target was not found: ${label}`);
  return source.replace(needle, replacement);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Centerhold progression section was not found: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const centerholdPath = path.join(ROOT, 'dist', 'centerhold-defense', 'index.html');
let centerhold = await readFile(centerholdPath, 'utf8');

centerhold = replaceOnce(
  centerhold,
  '    @media (max-width: 700px) {',
  `    #endless-screen .panel {
      width: min(560px, 100%);
      border-color: rgba(255, 209, 102, 0.34);
      box-shadow: 0 18px 72px rgba(255, 101, 122, 0.12), 0 18px 60px rgba(0,0,0,0.42);
    }

    #endless-screen h2 {
      color: var(--gold);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    @media (max-width: 700px) {`,
  'endless styles'
);

centerhold = replaceOnce(
  centerhold,
  '    <section id="game-over-screen" class="overlay hidden">',
  `    <section id="endless-screen" class="overlay hidden">
      <div class="panel">
        <h2>Endless Mode</h2>
        <p class="subtext">Every enemy type is now active. From here on, each upgrade you take also pushes the swarm to send more bodies at the Centerhold.</p>
        <button id="endless-button" class="primary">Keep defending</button>
      </div>
    </section>

    <section id="game-over-screen" class="overlay hidden">`,
  'endless overlay'
);

centerhold = replaceOnce(
  centerhold,
  "        pause: document.getElementById('pause-screen'),",
  `        pause: document.getElementById('pause-screen'),
        endless: document.getElementById('endless-screen'),
        endlessButton: document.getElementById('endless-button'),`,
  'endless element references'
);

centerhold = replaceOnce(
  centerhold,
  '      let upgradeChoices;',
  `      let upgradeChoices;
      let upgradeCount;
      let endlessIntroShown;

      const ENDLESS_START_WAVE = 25;
      const NEW_ENEMY_BY_WAVE = {
        8: 'Charger', 10: 'Splitter', 12: 'Weaver', 15: 'Bulwark', 18: 'Dasher', 22: 'Siege'
      };`,
  'progression state'
);

centerhold = replaceSection(
  centerhold,
  '      const enemyTypes = {',
  '      const upgrades = [',
  `      const enemyTypes = {
        grunt:    { name: 'Crawler',  radius: 12, speed: 48, hp: 24,  damage: 10, color: '#ff657a', reward: 1 },
        runner:   { name: 'Skitter',  radius: 8,  speed: 88, hp: 14,  damage: 7,  color: '#ff9f43', reward: 1 },
        tank:     { name: 'Brute',    radius: 19, speed: 31, hp: 72,  damage: 20, color: '#b88cff', reward: 3 },
        orbiter:  { name: 'Wisp',     radius: 10, speed: 58, hp: 30,  damage: 12, color: '#58d6ff', reward: 2 },
        charger:  { name: 'Charger',  radius: 13, speed: 52, hp: 42,  damage: 16, color: '#ffd166', reward: 2 },
        splitter: { name: 'Splitter', radius: 16, speed: 43, hp: 58,  damage: 15, color: '#59e391', reward: 3 },
        zigzag:   { name: 'Weaver',   radius: 12, speed: 64, hp: 46,  damage: 14, color: '#7da2ff', reward: 2 },
        bulwark:  { name: 'Bulwark',  radius: 24, speed: 27, hp: 150, damage: 30, color: '#d993ff', reward: 5 },
        dasher:   { name: 'Dasher',   radius: 10, speed: 58, hp: 40,  damage: 12, color: '#ff78d1', reward: 3 },
        siege:    { name: 'Siege',    radius: 30, speed: 22, hp: 260, damage: 46, color: '#ff4d5f', reward: 7 },
        shard:    { name: 'Shard',    radius: 6,  speed: 108, hp: 15, damage: 6,  color: '#8df0b3', reward: 1 }
      };

`,
  'enemy type table'
);

centerhold = replaceOnce(
  centerhold,
  '        upgradeChoices = [];',
  `        upgradeChoices = [];
        upgradeCount = 0;
        endlessIntroShown = false;`,
  'reset progression state'
);

centerhold = replaceOnce(
  centerhold,
  "        els.pause.classList.add('hidden');",
  `        els.pause.classList.add('hidden');
        els.endless.classList.add('hidden');`,
  'start game overlay reset'
);

centerhold = replaceSection(
  centerhold,
  '      function beginWave() {',
  '      function spawnEnemy(typeName) {',
  `      function beginWave() {
        wave += 1;
        spawnQueue = buildWave(wave);
        spawnTimer = 0.25;
        nextWaveDelay = 0;

        if (wave === ENDLESS_START_WAVE && !endlessIntroShown) {
          endlessIntroShown = true;
          state = 'endlessIntro';
          els.endless.classList.remove('hidden');
          updateHud();
          return;
        }

        const newEnemy = NEW_ENEMY_BY_WAVE[wave];
        showToast(newEnemy ? \`Wave \${wave} · New: \${newEnemy}\` : (wave >= ENDLESS_START_WAVE ? \`Endless \${wave - ENDLESS_START_WAVE + 1}\` : \`Wave \${wave}\`));
        updateHud();
      }

      function enemyWeight(type, n) {
        const unlocks = {
          grunt: 1, runner: 2, tank: 4, orbiter: 6, charger: 8,
          splitter: 10, zigzag: 12, bulwark: 15, dasher: 18, siege: 22
        };
        if (n < unlocks[type]) return 0;

        const weights = {
          grunt: 34, runner: 15, tank: 11, orbiter: 9, charger: 10,
          splitter: 8, zigzag: 8, bulwark: 5, dasher: 7, siege: 3
        };
        let weight = weights[type];
        if (type === 'grunt') weight = Math.max(16, 34 - Math.floor(n * 0.55));
        if (type === 'runner' && n >= 12) weight += 3;
        if (type === 'siege' && n >= ENDLESS_START_WAVE) weight += Math.min(5, Math.floor((n - ENDLESS_START_WAVE) / 4));
        return weight;
      }

      function pickWaveEnemy(n) {
        const types = ['grunt','runner','tank','orbiter','charger','splitter','zigzag','bulwark','dasher','siege'];
        const weighted = types.map(type => [type, enemyWeight(type, n)]).filter(([, weight]) => weight > 0);
        const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = Math.random() * total;
        for (const [type, weight] of weighted) {
          roll -= weight;
          if (roll <= 0) return type;
        }
        return 'grunt';
      }

      function buildWave(n) {
        const queue = [];
        let count = 5 + Math.floor(n * 2.35);

        if (n >= ENDLESS_START_WAVE) {
          const endlessDepth = n - ENDLESS_START_WAVE;
          const upgradePressure = Math.floor(upgradeCount * 0.80);
          const depthPressure = Math.floor(endlessDepth * 2.75 + Math.pow(endlessDepth, 1.22));
          count += upgradePressure + depthPressure;
        }

        for (let i = 0; i < count; i++) queue.push(pickWaveEnemy(n));

        if (n >= 4 && n % 5 === 0) queue.push('tank', 'tank');
        if (n >= 15 && n % 5 === 0) queue.push('bulwark');
        if (n >= 22 && n % 4 === 0) queue.push('siege');
        return shuffle(queue);
      }

`,
  'wave builder'
);

centerhold = replaceOnce(
  centerhold,
  '          orbitSign: Math.random() < 0.5 ? -1 : 1,',
  `          orbitSign: Math.random() < 0.5 ? -1 : 1,
          phase: Math.random() * Math.PI * 2,
          age: Math.random() * 2,`,
  'enemy movement state'
);

centerhold = replaceSection(
  centerhold,
  '      function updateEnemies(dt) {',
  '      function damageBase(amount) {',
  `      function updateEnemies(dt) {
        for (const enemy of enemies) {
          if (enemy.dead) continue;
          enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
          enemy.age += dt;

          let dx = base.x - enemy.x;
          let dy = base.y - enemy.y;
          const dist = Math.max(0.0001, Math.hypot(dx, dy));
          dx /= dist;
          dy /= dist;

          if (enemy.type === 'orbiter' && dist > 125) {
            const tangentX = -dy * enemy.orbitSign;
            const tangentY = dx * enemy.orbitSign;
            dx = dx * 0.75 + tangentX * 0.66;
            dy = dy * 0.75 + tangentY * 0.66;
          }

          if (enemy.type === 'zigzag' && dist > 95) {
            const tangentX = -dy;
            const tangentY = dx;
            const weave = Math.sin(enemy.age * 6.2 + enemy.phase) * 0.82;
            dx += tangentX * weave;
            dy += tangentY * weave;
          }

          let speedMultiplier = 1;
          if (enemy.type === 'charger' && dist < 215) speedMultiplier = 1.72;
          if (enemy.type === 'dasher') {
            const dashCycle = (enemy.age + enemy.phase) % 1.85;
            if (dashCycle < 0.42) speedMultiplier = 2.35;
            else if (dashCycle < 0.65) speedMultiplier = 0.72;
          }

          const norm = Math.max(0.0001, Math.hypot(dx, dy));
          dx /= norm;
          dy /= norm;

          enemy.x += dx * enemy.speed * speedMultiplier * dt;
          enemy.y += dy * enemy.speed * speedMultiplier * dt;

          if (dist <= base.radius + enemy.radius) {
            damageBase(enemy.damage);
            enemy.dead = true;
            burst(enemy.x, enemy.y, enemy.color, 14, 180);
          }
        }
      }

`,
  'advanced enemy movement'
);

centerhold = replaceSection(
  centerhold,
  '      function killEnemy(enemy) {',
  '      function updateParticles(dt) {',
  `      function killEnemy(enemy) {
        if (enemy.dead) return;
        enemy.dead = true;
        kills += enemy.reward;
        burst(enemy.x, enemy.y, enemy.color, 12, 190);
        screenShake = Math.min(5, screenShake + 1.3);

        if (enemy.type === 'splitter') {
          for (let i = 0; i < 2; i++) spawnShard(enemy.x, enemy.y, i === 0 ? -1 : 1);
        }
      }

      function spawnShard(x, y, side) {
        const template = enemyTypes.shard;
        const hpScale = 1 + (wave - 1) * 0.13;
        const speedScale = 1 + Math.min(0.75, (wave - 1) * 0.025);
        enemies.push({
          type: 'shard',
          x: x + side * 7,
          y: y - 5,
          radius: template.radius,
          speed: template.speed * speedScale,
          hp: template.hp * hpScale,
          maxHp: template.hp * hpScale,
          damage: template.damage * (1 + (wave - 1) * 0.045),
          color: template.color,
          reward: template.reward,
          orbitSign: side,
          phase: Math.random() * Math.PI * 2,
          age: 0,
          dead: false,
          hitFlash: 0
        });
      }

`,
  'splitter behavior'
);

centerhold = replaceOnce(
  centerhold,
  '        upgrade.apply();',
  `        upgrade.apply();
        upgradeCount += 1;`,
  'upgrade counter'
);

centerhold = replaceOnce(
  centerhold,
  '        els.wave.textContent = wave || 1;',
  '        els.wave.textContent = wave >= ENDLESS_START_WAVE ? `${wave} ∞` : (wave || 1);',
  'endless wave HUD'
);

centerhold = replaceSection(
  centerhold,
  '      function drawEnemies() {',
  '      function drawBullets() {',
  `      function drawEnemies() {
        for (const enemy of enemies) {
          ctx.save();
          ctx.translate(enemy.x, enemy.y);
          const color = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;

          ctx.beginPath();
          if (enemy.type === 'runner') {
            for (let i = 0; i < 8; i++) {
              const a = i * Math.PI / 4;
              const r = i % 2 ? enemy.radius * 0.55 : enemy.radius;
              const x = Math.cos(a) * r;
              const y = Math.sin(a) * r;
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
          } else if (enemy.type === 'tank') {
            ctx.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
          } else if (enemy.type === 'orbiter') {
            ctx.rotate(performance.now() * 0.003 * enemy.orbitSign);
            ctx.moveTo(enemy.radius, 0);
            for (let i = 1; i < 6; i++) {
              const a = i * Math.PI * 2 / 6;
              ctx.lineTo(Math.cos(a) * enemy.radius, Math.sin(a) * enemy.radius);
            }
            ctx.closePath();
          } else if (enemy.type === 'charger') {
            ctx.rotate(Math.atan2(base.y - enemy.y, base.x - enemy.x));
            ctx.moveTo(enemy.radius * 1.15, 0);
            ctx.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.72);
            ctx.lineTo(-enemy.radius * 0.45, 0);
            ctx.lineTo(-enemy.radius * 0.8, enemy.radius * 0.72);
            ctx.closePath();
          } else if (enemy.type === 'splitter') {
            ctx.rotate(Math.PI / 4);
            ctx.rect(-enemy.radius * 0.72, -enemy.radius * 0.72, enemy.radius * 1.44, enemy.radius * 1.44);
          } else if (enemy.type === 'zigzag') {
            ctx.rotate(Math.atan2(base.y - enemy.y, base.x - enemy.x));
            ctx.moveTo(enemy.radius, 0);
            ctx.lineTo(enemy.radius * 0.25, -enemy.radius * 0.72);
            ctx.lineTo(-enemy.radius * 0.15, -enemy.radius * 0.15);
            ctx.lineTo(-enemy.radius, -enemy.radius * 0.62);
            ctx.lineTo(-enemy.radius * 0.35, enemy.radius * 0.05);
            ctx.lineTo(enemy.radius * 0.12, enemy.radius * 0.72);
            ctx.closePath();
          } else if (enemy.type === 'bulwark') {
            for (let i = 0; i < 8; i++) {
              const a = Math.PI / 8 + i * Math.PI / 4;
              const x = Math.cos(a) * enemy.radius;
              const y = Math.sin(a) * enemy.radius;
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
          } else if (enemy.type === 'dasher') {
            ctx.rotate(Math.atan2(base.y - enemy.y, base.x - enemy.x));
            ctx.moveTo(enemy.radius * 1.45, 0);
            ctx.lineTo(-enemy.radius * 0.4, -enemy.radius * 0.72);
            ctx.lineTo(-enemy.radius, 0);
            ctx.lineTo(-enemy.radius * 0.4, enemy.radius * 0.72);
            ctx.closePath();
          } else if (enemy.type === 'siege') {
            for (let i = 0; i < 6; i++) {
              const a = i * Math.PI / 3;
              const x = Math.cos(a) * enemy.radius;
              const y = Math.sin(a) * enemy.radius;
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
          } else if (enemy.type === 'shard') {
            ctx.moveTo(enemy.radius * 1.25, 0);
            ctx.lineTo(0, -enemy.radius);
            ctx.lineTo(-enemy.radius * 1.25, 0);
            ctx.lineTo(0, enemy.radius);
            ctx.closePath();
          } else {
            ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          }
          ctx.fillStyle = color;
          ctx.fill();

          if (enemy.type === 'siege' || enemy.type === 'bulwark') {
            ctx.beginPath();
            ctx.arc(0, 0, enemy.radius * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(8,14,23,0.42)';
            ctx.fill();
          } else if (enemy.type === 'splitter') {
            ctx.beginPath();
            ctx.moveTo(-enemy.radius * 0.55, 0);
            ctx.lineTo(enemy.radius * 0.55, 0);
            ctx.strokeStyle = 'rgba(8,14,23,0.55)';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          const healthRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
          if (healthRatio < 0.995) {
            const width = enemy.radius * 2;
            ctx.fillStyle = 'rgba(0,0,0,0.48)';
            ctx.fillRect(-enemy.radius, -enemy.radius - 8, width, 3);
            ctx.fillStyle = '#f4f7fb';
            ctx.fillRect(-enemy.radius, -enemy.radius - 8, width * healthRatio, 3);
          }
          ctx.restore();
        }
      }

`,
  'enemy rendering'
);

centerhold = replaceOnce(
  centerhold,
  "      els.restartButton.addEventListener('click', startGame);",
  `      els.restartButton.addEventListener('click', startGame);
      els.endlessButton.addEventListener('click', () => {
        if (state !== 'endlessIntro') return;
        els.endless.classList.add('hidden');
        state = 'playing';
        lastTime = performance.now();
        showToast('Endless Mode');
      });`,
  'endless continue button'
);

await writeFile(centerholdPath, centerhold);
console.log('Applied Centerhold enemy tiers and endless progression patch.');
