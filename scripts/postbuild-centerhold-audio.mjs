import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const centerholdPath = path.join(ROOT, 'dist', 'centerhold-defense', 'index.html');

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Centerhold audio patch target was not found: ${label}`);
  return source.replace(needle, replacement);
}

let html = await readFile(centerholdPath, 'utf8');

html = replaceOnce(
  html,
  '    <section id="game-over-screen" class="overlay hidden">',
  `    <button id="soundBtn" type="button" hidden aria-hidden="true">Sound</button>\n\n    <section id="game-over-screen" class="overlay hidden">`,
  'sound toggle hook'
);

html = replaceOnce(
  html,
  '      function resetGame() {',
  `      const sfx = (() => {
        let audio = null;
        let master = null;
        let muted = false;
        let paused = false;
        let noiseBuffer = null;
        let lastShotAt = -Infinity;
        let lastHitAt = -Infinity;
        let lastKillAt = -Infinity;

        function unlock() {
          if (audio) {
            if (audio.state === 'suspended') {
              const resumed = audio.resume();
              if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
            }
            return audio;
          }
          if (muted) return null;

          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtor) return null;
          try {
            audio = new AudioCtor();
            master = audio.createGain();
            const compressor = audio.createDynamicsCompressor();
            compressor.threshold.value = -18;
            compressor.knee.value = 16;
            compressor.ratio.value = 5;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.18;
            master.gain.value = muted || paused ? 0 : 0.42;
            master.connect(compressor);
            compressor.connect(audio.destination);
            return audio;
          } catch {
            audio = null;
            master = null;
            return null;
          }
        }

        function setMaster(value, time = 0.025) {
          const ctx = unlock();
          if (!ctx || !master) return;
          const now = ctx.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setTargetAtTime(value, now, Math.max(0.005, time));
        }

        function setMuted(value) {
          muted = Boolean(value);
          if (audio && master) setMaster(muted || paused ? 0 : 0.42);
        }

        function toggleMuted() {
          setMuted(!muted);
          if (!muted) unlock();
          return muted;
        }

        function setPaused(value) {
          paused = Boolean(value);
          if (audio && master) setMaster(muted || paused ? 0 : 0.42, paused ? 0.012 : 0.04);
        }

        function makeNoiseBuffer(ctx) {
          if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
          const length = Math.floor(ctx.sampleRate * 0.35);
          noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          let last = 0;
          for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            last = last * 0.72 + white * 0.28;
            data[i] = last;
          }
          return noiseBuffer;
        }

        function tone({
          type = 'sine', from = 440, to = from, duration = 0.08,
          gain = 0.05, delay = 0, attack = 0.004, release = 0.055,
          detune = 0
        } = {}) {
          const ctx = unlock();
          if (!ctx || !master || muted || paused) return;
          const start = ctx.currentTime + Math.max(0, delay);
          const end = start + Math.max(0.02, duration);
          const oscillator = ctx.createOscillator();
          const amp = ctx.createGain();
          oscillator.type = type;
          oscillator.detune.value = detune;
          oscillator.frequency.setValueAtTime(Math.max(20, from), start);
          oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
          amp.gain.setValueAtTime(0.0001, start);
          amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.max(0.002, attack));
          amp.gain.setValueAtTime(Math.max(0.0002, gain), Math.max(start + attack, end - release));
          amp.gain.exponentialRampToValueAtTime(0.0001, end);
          oscillator.connect(amp);
          amp.connect(master);
          oscillator.start(start);
          oscillator.stop(end + 0.02);
        }

        function noise({ duration = 0.08, gain = 0.04, frequency = 1600, q = 0.7, delay = 0 } = {}) {
          const ctx = unlock();
          if (!ctx || !master || muted || paused) return;
          const start = ctx.currentTime + Math.max(0, delay);
          const end = start + Math.max(0.02, duration);
          const source = ctx.createBufferSource();
          const filter = ctx.createBiquadFilter();
          const amp = ctx.createGain();
          source.buffer = makeNoiseBuffer(ctx);
          filter.type = 'bandpass';
          filter.frequency.value = frequency;
          filter.Q.value = q;
          amp.gain.setValueAtTime(Math.max(0.0002, gain), start);
          amp.gain.exponentialRampToValueAtTime(0.0001, end);
          source.connect(filter);
          filter.connect(amp);
          amp.connect(master);
          source.start(start);
          source.stop(end + 0.01);
        }

        function note(freq, delay, gain = 0.045, duration = 0.11, type = 'triangle') {
          tone({ type, from: freq, to: freq * 0.985, duration, gain, delay, attack: 0.006, release: duration * 0.7 });
        }

        function shot(projectiles = 1) {
          const ctx = unlock();
          if (!ctx || muted || paused) return;
          const now = ctx.currentTime;
          if (now - lastShotAt < 0.028) return;
          lastShotAt = now;
          const body = Math.min(0.055, 0.032 + Math.max(0, projectiles - 1) * 0.0045);
          tone({ type: 'square', from: 780, to: 260, duration: 0.052, gain: body, release: 0.04 });
          tone({ type: 'sine', from: 1320, to: 620, duration: 0.035, gain: 0.014, delay: 0.003, release: 0.025 });
        }

        function hit(type) {
          const ctx = unlock();
          if (!ctx || muted || paused) return;
          const now = ctx.currentTime;
          if (now - lastHitAt < 0.035) return;
          lastHitAt = now;
          const heavy = type === 'tank' || type === 'bulwark' || type === 'siege';
          noise({ duration: heavy ? 0.055 : 0.035, gain: heavy ? 0.026 : 0.014, frequency: heavy ? 620 : 1800, q: 0.8 });
          tone({ type: 'triangle', from: heavy ? 150 : 310, to: heavy ? 115 : 240, duration: 0.045, gain: heavy ? 0.022 : 0.012, release: 0.035 });
        }

        function kill(type, reward = 1) {
          const ctx = unlock();
          if (!ctx || muted || paused) return;
          const now = ctx.currentTime;
          if (now - lastKillAt < 0.025) return;
          lastKillAt = now;

          if (type === 'siege' || type === 'bulwark' || type === 'tank') {
            const depth = type === 'siege' ? 64 : type === 'bulwark' ? 78 : 96;
            tone({ type: 'sawtooth', from: depth * 1.6, to: depth, duration: 0.16, gain: type === 'siege' ? 0.075 : 0.05, release: 0.12 });
            noise({ duration: type === 'siege' ? 0.18 : 0.11, gain: type === 'siege' ? 0.07 : 0.04, frequency: type === 'siege' ? 170 : 260, q: 0.55 });
            note(type === 'siege' ? 196 : 247, 0.035, 0.03, 0.1, 'triangle');
            return;
          }

          if (type === 'orbiter' || type === 'zigzag') {
            tone({ type: 'sine', from: 520, to: 880, duration: 0.11, gain: 0.035, release: 0.08 });
            note(1046, 0.045, 0.018, 0.07, 'sine');
            return;
          }

          if (type === 'splitter') {
            tone({ type: 'square', from: 390, to: 620, duration: 0.07, gain: 0.03, release: 0.05 });
            note(780, 0.055, 0.02, 0.055, 'square');
            note(930, 0.085, 0.016, 0.045, 'square');
            return;
          }

          const pitch = type === 'runner' || type === 'shard' ? 620 : type === 'charger' || type === 'dasher' ? 470 : 390;
          tone({ type: 'triangle', from: pitch * 1.12, to: pitch, duration: 0.065, gain: 0.026 + Math.min(0.018, reward * 0.002), release: 0.05 });
        }

        function baseHit(amount = 10) {
          const force = Math.min(1, Math.max(0.35, amount / 34));
          tone({ type: 'sawtooth', from: 110, to: 48, duration: 0.23, gain: 0.075 * force, release: 0.17 });
          tone({ type: 'sine', from: 66, to: 38, duration: 0.28, gain: 0.08 * force, release: 0.22 });
          noise({ duration: 0.18, gain: 0.075 * force, frequency: 210, q: 0.5 });
        }

        function waveStart(waveNumber, newEnemy = false) {
          if (newEnemy) {
            tone({ type: 'sawtooth', from: 118, to: 92, duration: 0.22, gain: 0.045, release: 0.17 });
            note(294, 0.08, 0.038, 0.1, 'square');
            note(440, 0.16, 0.032, 0.12, 'triangle');
            return;
          }
          const root = 220 * Math.pow(2, ((waveNumber - 1) % 4) / 12);
          note(root, 0, 0.032, 0.08);
          note(root * 1.25, 0.07, 0.035, 0.085);
          note(root * 1.5, 0.14, 0.038, 0.095);
        }

        function upgradeReady() {
          note(330, 0, 0.025, 0.12, 'sine');
          note(440, 0.055, 0.025, 0.13, 'sine');
          note(554.37, 0.11, 0.028, 0.16, 'sine');
        }

        function upgradeSelect(id) {
          const roots = { damage: 196, rate: 220, speed: 247, range: 262, pierce: 174, multishot: 208, repair: 165, bulletspeed: 233 };
          const root = roots[id] || 220;
          note(root, 0, 0.045, 0.1, 'triangle');
          note(root * 1.25, 0.055, 0.11, 'triangle');
          note(root * 1.5, 0.11, 0.044, 0.14, 'triangle');
          noise({ duration: 0.05, gain: 0.012, frequency: 2600, q: 1.1, delay: 0.08 });
        }

        function endless() {
          tone({ type: 'sawtooth', from: 82, to: 55, duration: 0.62, gain: 0.07, release: 0.5 });
          noise({ duration: 0.3, gain: 0.055, frequency: 150, q: 0.45 });
          note(220, 0.04, 0.04, 0.18, 'triangle');
          note(277.18, 0.15, 0.043, 0.18, 'triangle');
          note(329.63, 0.26, 0.046, 0.2, 'triangle');
          note(440, 0.39, 0.055, 0.28, 'triangle');
        }

        function gameOver() {
          tone({ type: 'sawtooth', from: 96, to: 45, duration: 0.7, gain: 0.065, release: 0.58 });
          note(329.63, 0, 0.038, 0.2, 'triangle');
          note(261.63, 0.18, 0.036, 0.22, 'triangle');
          note(196, 0.36, 0.034, 0.25, 'triangle');
          note(130.81, 0.58, 0.03, 0.34, 'sine');
        }

        return {
          unlock,
          toggleMuted,
          setPaused,
          shot,
          hit,
          kill,
          baseHit,
          waveStart,
          upgradeReady,
          upgradeSelect,
          endless,
          gameOver
        };
      })();

      document.getElementById('soundBtn')?.addEventListener('click', () => {
        const muted = sfx.toggleMuted();
        const menuButton = document.querySelector('[data-escapee-action="sound"]');
        if (menuButton) menuButton.textContent = muted ? 'Sound: Off' : 'Sound: On';
      });
      window.addEventListener('DOMContentLoaded', () => {
        const menuButton = document.querySelector('[data-escapee-action="sound"]');
        if (menuButton) menuButton.textContent = 'Sound: On';
      }, { once: true });
      window.addEventListener('escapee:pause', () => sfx.setPaused(true));
      window.addEventListener('escapee:resume', () => sfx.setPaused(false));

      function resetGame() {`,
  'audio engine'
);

html = replaceOnce(
  html,
  '      function startGame() {\n        resetGame();',
  `      function startGame() {\n        sfx.unlock();\n        resetGame();`,
  'audio unlock on start'
);

html = replaceOnce(
  html,
  `        if (wave === ENDLESS_START_WAVE && !endlessIntroShown) {
          endlessIntroShown = true;
          state = 'endlessIntro';`,
  `        if (wave === ENDLESS_START_WAVE && !endlessIntroShown) {
          endlessIntroShown = true;
          sfx.endless();
          state = 'endlessIntro';`,
  'endless sting'
);

html = replaceOnce(
  html,
  '        const newEnemy = NEW_ENEMY_BY_WAVE[wave];',
  `        const newEnemy = NEW_ENEMY_BY_WAVE[wave];
        sfx.waveStart(wave, Boolean(newEnemy));`,
  'wave sound'
);

html = replaceOnce(
  html,
  '        burst(player.x + Math.cos(baseAngle) * 14, player.y + Math.sin(baseAngle) * 14, \'#fff4b2\', 3, 60);',
  `        burst(player.x + Math.cos(baseAngle) * 14, player.y + Math.sin(baseAngle) * 14, '#fff4b2', 3, 60);
        sfx.shot(player.projectiles);`,
  'shot sound'
);

html = replaceOnce(
  html,
  '              enemy.hitFlash = 0.12;',
  `              enemy.hitFlash = 0.12;
              sfx.hit(enemy.type);`,
  'hit sound'
);

html = replaceOnce(
  html,
  '      function damageBase(amount) {\n        base.hp = Math.max(0, base.hp - amount);',
  `      function damageBase(amount) {
        sfx.baseHit(amount);
        base.hp = Math.max(0, base.hp - amount);`,
  'base damage sound'
);

html = replaceOnce(
  html,
  `        kills += enemy.reward;
        burst(enemy.x, enemy.y, enemy.color, 12, 190);`,
  `        kills += enemy.reward;
        sfx.kill(enemy.type, enemy.reward);
        burst(enemy.x, enemy.y, enemy.color, 12, 190);`,
  'kill sound'
);

html = replaceOnce(
  html,
  `      function showUpgrades() {
        state = 'upgrade';`,
  `      function showUpgrades() {
        state = 'upgrade';
        sfx.upgradeReady();`,
  'upgrade-ready sound'
);

html = replaceOnce(
  html,
  `        const upgrade = upgradeChoices[index];
        upgrade.apply();`,
  `        const upgrade = upgradeChoices[index];
        sfx.upgradeSelect(upgrade.id);
        upgrade.apply();`,
  'upgrade selection sound'
);

html = replaceOnce(
  html,
  `      function endGame() {
        state = 'gameover';`,
  `      function endGame() {
        state = 'gameover';
        sfx.gameOver();`,
  'game-over sound'
);

await writeFile(centerholdPath, html);
console.log('Applied Centerhold synthesized audio system.');
