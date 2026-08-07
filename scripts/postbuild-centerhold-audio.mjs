import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');

function patch(needle, replacement, label) {
  if (!html.includes(needle)) throw new Error(`Centerhold audio patch target missing: ${label}`);
  html = html.replace(needle, replacement);
}

patch(
  '    <section id="game-over-screen" class="overlay hidden">',
  '    <button id="soundBtn" type="button" hidden aria-hidden="true">Sound</button>\n\n    <section id="game-over-screen" class="overlay hidden">',
  'sound button'
);

patch('      function resetGame() {', `      const sfx = (() => {
        let ctx = null;
        let master = null;
        let muted = false;
        let paused = false;
        let noiseBuffer = null;
        const last = { shot: -99, hit: -99, kill: -99 };

        function unlock() {
          if (ctx) {
            if (ctx.state === 'suspended') ctx.resume()?.catch?.(() => {});
            return ctx;
          }
          if (muted) return null;
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtor) return null;
          try {
            ctx = new AudioCtor();
            master = ctx.createGain();
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -18;
            comp.knee.value = 16;
            comp.ratio.value = 5;
            comp.attack.value = 0.003;
            comp.release.value = 0.18;
            master.gain.value = muted || paused ? 0 : 0.42;
            master.connect(comp);
            comp.connect(ctx.destination);
            return ctx;
          } catch {
            ctx = null;
            master = null;
            return null;
          }
        }

        function level(value, tau = 0.025) {
          const audio = unlock();
          if (!audio || !master) return;
          master.gain.cancelScheduledValues(audio.currentTime);
          master.gain.setTargetAtTime(value, audio.currentTime, tau);
        }

        function setMuted(value) {
          muted = Boolean(value);
          if (ctx && master) level(muted || paused ? 0 : 0.42);
          return muted;
        }

        function getMuted() {
          return muted;
        }

        function toggle() {
          const value = setMuted(!muted);
          if (!value) unlock();
          return value;
        }

        function setPaused(value) {
          paused = Boolean(value);
          if (ctx && master) level(muted || paused ? 0 : 0.42, paused ? 0.012 : 0.04);
        }

        function tone(from, to, duration, gain, type = 'triangle', delay = 0) {
          const audio = unlock();
          if (!audio || !master || muted || paused) return;
          const start = audio.currentTime + delay;
          const end = start + duration;
          const osc = audio.createOscillator();
          const amp = audio.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(Math.max(20, from), start);
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
          amp.gain.setValueAtTime(0.0001, start);
          amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.005);
          amp.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(amp);
          amp.connect(master);
          osc.start(start);
          osc.stop(end + 0.02);
        }

        function note(freq, delay = 0, gain = 0.04, duration = 0.11, type = 'triangle') {
          tone(freq, freq * 0.985, duration, gain, type, delay);
        }

        function noise(duration = 0.07, gain = 0.035, frequency = 1200, delay = 0) {
          const audio = unlock();
          if (!audio || !master || muted || paused) return;
          if (!noiseBuffer || noiseBuffer.sampleRate !== audio.sampleRate) {
            noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.35), audio.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            let filtered = 0;
            for (let i = 0; i < data.length; i++) {
              filtered = filtered * 0.72 + (Math.random() * 2 - 1) * 0.28;
              data[i] = filtered;
            }
          }
          const start = audio.currentTime + delay;
          const source = audio.createBufferSource();
          const filter = audio.createBiquadFilter();
          const amp = audio.createGain();
          source.buffer = noiseBuffer;
          filter.type = 'bandpass';
          filter.frequency.value = frequency;
          filter.Q.value = 0.7;
          amp.gain.setValueAtTime(gain, start);
          amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          source.connect(filter);
          filter.connect(amp);
          amp.connect(master);
          source.start(start);
          source.stop(start + duration + 0.01);
        }

        function throttled(name, gap) {
          const audio = unlock();
          if (!audio || muted || paused || audio.currentTime - last[name] < gap) return false;
          last[name] = audio.currentTime;
          return true;
        }

        function shot(projectiles) {
          if (!throttled('shot', 0.028)) return;
          const body = Math.min(0.055, 0.032 + Math.max(0, projectiles - 1) * 0.0045);
          tone(780, 260, 0.052, body, 'square');
          tone(1320, 620, 0.035, 0.014, 'sine', 0.003);
        }

        function hit(type) {
          if (!throttled('hit', 0.035)) return;
          const heavy = type === 'tank' || type === 'bulwark' || type === 'siege';
          noise(heavy ? 0.055 : 0.035, heavy ? 0.026 : 0.014, heavy ? 620 : 1800);
          tone(heavy ? 150 : 310, heavy ? 115 : 240, 0.045, heavy ? 0.022 : 0.012);
        }

        function kill(type, reward) {
          if (!throttled('kill', 0.025)) return;
          if (type === 'siege' || type === 'bulwark' || type === 'tank') {
            const root = type === 'siege' ? 64 : type === 'bulwark' ? 78 : 96;
            tone(root * 1.6, root, 0.16, type === 'siege' ? 0.075 : 0.05, 'sawtooth');
            noise(type === 'siege' ? 0.18 : 0.11, type === 'siege' ? 0.07 : 0.04, type === 'siege' ? 170 : 260);
            note(type === 'siege' ? 196 : 247, 0.035, 0.03, 0.1);
          } else if (type === 'orbiter' || type === 'zigzag') {
            tone(520, 880, 0.11, 0.035, 'sine');
            note(1046, 0.045, 0.018, 0.07, 'sine');
          } else if (type === 'splitter') {
            tone(390, 620, 0.07, 0.03, 'square');
            note(780, 0.055, 0.02, 0.055, 'square');
            note(930, 0.085, 0.016, 0.045, 'square');
          } else {
            const pitch = type === 'runner' || type === 'shard' ? 620 : type === 'charger' || type === 'dasher' ? 470 : 390;
            tone(pitch * 1.12, pitch, 0.065, 0.026 + Math.min(0.018, reward * 0.002));
          }
        }

        function baseHit(amount) {
          const force = Math.min(1, Math.max(0.35, amount / 34));
          tone(110, 48, 0.23, 0.075 * force, 'sawtooth');
          tone(66, 38, 0.28, 0.08 * force, 'sine');
          noise(0.18, 0.075 * force, 210);
        }

        function waveStart(number, newEnemy) {
          if (newEnemy) {
            tone(118, 92, 0.22, 0.045, 'sawtooth');
            note(294, 0.08, 0.038, 0.1, 'square');
            note(440, 0.16, 0.032, 0.12);
            return;
          }
          const root = 220 * Math.pow(2, ((number - 1) % 4) / 12);
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
          note(root, 0, 0.045, 0.1);
          note(root * 1.25, 0.055, 0.04, 0.11);
          note(root * 1.5, 0.11, 0.044, 0.14);
          noise(0.05, 0.012, 2600, 0.08);
        }

        function endless() {
          tone(82, 55, 0.62, 0.07, 'sawtooth');
          noise(0.3, 0.055, 150);
          note(220, 0.04, 0.04, 0.18);
          note(277.18, 0.15, 0.043, 0.18);
          note(329.63, 0.26, 0.046, 0.2);
          note(440, 0.39, 0.055, 0.28);
        }

        function gameOver() {
          tone(96, 45, 0.7, 0.065, 'sawtooth');
          note(329.63, 0, 0.038, 0.2);
          note(261.63, 0.18, 0.036, 0.22);
          note(196, 0.36, 0.034, 0.25);
          note(130.81, 0.58, 0.03, 0.34, 'sine');
        }

        return { unlock, toggle, setMuted, getMuted, setPaused, shot, hit, kill, baseHit, waveStart, upgradeReady, upgradeSelect, endless, gameOver };
      })();
      window.__centerholdSfx = sfx;

      function syncSoundLabel(muted) {
        const button = document.querySelector('[data-escapee-action="sound"]');
        if (button) button.textContent = muted ? 'Sound: Off' : 'Sound: On';
      }

      document.getElementById('soundBtn')?.addEventListener('click', () => syncSoundLabel(sfx.toggle()));
      window.addEventListener('DOMContentLoaded', () => syncSoundLabel(false), { once: true });
      window.addEventListener('escapee:pause', () => sfx.setPaused(true));
      window.addEventListener('escapee:resume', () => sfx.setPaused(false));

      function resetGame() {`, 'audio engine');

patch(
  '      function startGame() {\n        resetGame();',
  '      function startGame() {\n        sfx.unlock();\n        resetGame();',
  'unlock on start'
);

patch(
  `        if (wave === ENDLESS_START_WAVE && !endlessIntroShown) {
          endlessIntroShown = true;
          state = 'endlessIntro';`,
  `        if (wave === ENDLESS_START_WAVE && !endlessIntroShown) {
          endlessIntroShown = true;
          sfx.endless();
          state = 'endlessIntro';`,
  'endless sound'
);

patch(
  '        const newEnemy = NEW_ENEMY_BY_WAVE[wave];',
  '        const newEnemy = NEW_ENEMY_BY_WAVE[wave];\n        sfx.waveStart(wave, Boolean(newEnemy));',
  'wave sound'
);

patch(
  "        burst(player.x + Math.cos(baseAngle) * 14, player.y + Math.sin(baseAngle) * 14, '#fff4b2', 3, 60);",
  "        burst(player.x + Math.cos(baseAngle) * 14, player.y + Math.sin(baseAngle) * 14, '#fff4b2', 3, 60);\n        sfx.shot(player.projectiles);",
  'shot sound'
);

patch('              enemy.hitFlash = 0.12;', '              enemy.hitFlash = 0.12;\n              sfx.hit(enemy.type);', 'hit sound');
patch('      function damageBase(amount) {\n        base.hp = Math.max(0, base.hp - amount);', '      function damageBase(amount) {\n        sfx.baseHit(amount);\n        base.hp = Math.max(0, base.hp - amount);', 'base sound');
patch('        kills += enemy.reward;\n        burst(enemy.x, enemy.y, enemy.color, 12, 190);', '        kills += enemy.reward;\n        sfx.kill(enemy.type, enemy.reward);\n        burst(enemy.x, enemy.y, enemy.color, 12, 190);', 'kill sound');
patch("      function showUpgrades() {\n        state = 'upgrade';", "      function showUpgrades() {\n        state = 'upgrade';\n        sfx.upgradeReady();", 'upgrade-ready sound');
patch('        const upgrade = upgradeChoices[index];\n        upgrade.apply();', '        const upgrade = upgradeChoices[index];\n        sfx.upgradeSelect(upgrade.id);\n        upgrade.apply();', 'upgrade-select sound');
patch("      function endGame() {\n        state = 'gameover';", "      function endGame() {\n        state = 'gameover';\n        sfx.gameOver();", 'game-over sound');

await writeFile(file, html);
console.log('Applied Centerhold synthesized audio system.');
