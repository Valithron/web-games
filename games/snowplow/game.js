    (() => {
      'use strict';

      const canvas = document.querySelector('#canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      const game = document.querySelector('#game');
      const startOverlay = document.querySelector('#startOverlay');
      const upgradeOverlay = document.querySelector('#upgradeOverlay');
      const gameOverOverlay = document.querySelector('#gameOverOverlay');
      const upgradeGrid = document.querySelector('#upgradeGrid');
      const message = document.querySelector('#message');
      const warning = document.querySelector('#warning');
      const joystick = document.querySelector('#joystick');
      const blowerButton = document.querySelector('#blowerButton');
      const blowerChargesLabel = document.querySelector('#blowerCharges');
      const hud = {
        roundValue: document.querySelector('#roundValue'),
        roundFill: document.querySelector('#roundFill'),
        accessValue: document.querySelector('#accessValue'),
        accessFill: document.querySelector('#accessFill'),
        fuelValue: document.querySelector('#fuelValue'),
        fuelFill: document.querySelector('#fuelFill'),
        scoreValue: document.querySelector('#scoreValue'),
        scoreFill: document.querySelector('#scoreFill')
      };

      const GRID = 36;
      const ROAD_LINES = [.22, .5, .78];
      const ROAD_HALF = .052;
      const ROUND_SECONDS = 42;
      const BUILDINGS = [
        { x: .09, y: .22, doorX: .17, doorY: .22, label: 'Clinic', color: '#d66f72' },
        { x: .34, y: .12, doorX: .34, doorY: .18, label: 'School', color: '#ddb55d' },
        { x: .66, y: .12, doorX: .66, doorY: .18, label: 'Market', color: '#81b66a' },
        { x: .91, y: .22, doorX: .83, doorY: .22, label: 'Fire hall', color: '#d45d4d' },
        { x: .09, y: .78, doorX: .17, doorY: .78, label: 'Homes', color: '#8a9ecc' },
        { x: .34, y: .88, doorX: .34, doorY: .82, label: 'Church', color: '#aa8fc5' },
        { x: .66, y: .88, doorX: .66, doorY: .82, label: 'Depot', color: '#75aeb6' },
        { x: .91, y: .78, doorX: .83, doorY: .78, label: 'Lodge', color: '#c98663' }
      ];

      const snow = new Float32Array(GRID * GRID);
      const salt = new Float32Array(GRID * GRID);
      const roadMask = new Uint8Array(GRID * GRID);
      const keys = new Set();
      const snowflakes = Array.from({ length: 95 }, (_, i) => ({
        x: (i * 0.61803398875) % 1,
        y: (i * 0.38196601125) % 1,
        speed: .045 + (i % 11) * .004,
        drift: ((i % 7) - 3) * .003,
        size: .7 + (i % 4) * .55
      }));

      let width = 0;
      let height = 0;
      let dpr = 1;
      let status = 'menu';
      let paused = false;
      let muted = false;
      let lastTime = performance.now();
      let elapsed = 0;
      let roundTime = 0;
      let round = 1;
      let score = 0;
      let clearedTotal = 0;
      let dangerTime = 0;
      let accessibleCount = BUILDINGS.length;
      let toastTime = 0;
      let animationId = 0;
      let audio = null;
      let touchPointer = null;
      let touchOrigin = null;
      let touchAxisX = 0;
      let touchAxisY = 0;
      let blowerHeld = false;
      let blowerTime = 0;
      let blowerCharges = 0;
      let lastBlowerHeld = false;

      const player = { x: .5, y: .5, angle: -Math.PI / 2, speed: 0 };
      const upgrades = { plow: 0, speed: 0, tank: 0, salt: 0, blower: 0 };
      let fuel = 100;

      const UPGRADE_DEFS = {
        plow: { icon: '↔', name: 'Wider plow', description: level => `Clear ${Math.round((1 + (level + 1) * .22) * 100)}% of the base width.` },
        speed: { icon: '➤', name: 'Faster vehicle', description: level => `Increase road speed by ${Math.round((level + 1) * 14)}%.` },
        tank: { icon: '▰', name: 'Larger fuel tank', description: level => `Carry ${Math.round((1 + (level + 1) * .25) * 100)}% of the base fuel.` },
        salt: { icon: '✦', name: 'Salt spreader', description: level => level === 0 ? 'Salt cleared roads so snow returns more slowly.' : `Keep cleared roads protected for ${10 + (level + 1) * 5} seconds.` },
        blower: { icon: '◎', name: 'Temporary blower', description: level => level === 0 ? 'Unlock one emergency area-clearing blast each storm.' : `Start each storm with ${level + 2} blower charges.` }
      };

      function safeGetBest() {
        try { return Number(localStorage.getItem('escapee:snowplow:best')) || 0; } catch { return 0; }
      }

      function safeSetBest(value) {
        try { localStorage.setItem('escapee:snowplow:best', String(value)); } catch {}
      }

      function setupRoadMask() {
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            const nx = (x + .5) / GRID;
            const ny = (y + .5) / GRID;
            const road = ROAD_LINES.some(v => Math.abs(nx - v) < ROAD_HALF || Math.abs(ny - v) < ROAD_HALF);
            roadMask[y * GRID + x] = road ? 1 : 0;
          }
        }
      }

      function resize() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function showMessage(text, seconds = 1.5) {
        message.textContent = text;
        message.classList.add('is-visible');
        toastTime = seconds;
      }

      function resetInputs() {
        keys.clear();
        touchPointer = null;
        touchOrigin = null;
        touchAxisX = 0;
        touchAxisY = 0;
        blowerHeld = false;
        lastBlowerHeld = false;
        joystick.style.setProperty('--stick-x', '0px');
        joystick.style.setProperty('--stick-y', '0px');
        blowerButton.classList.remove('is-active');
      }

      function createAudio() {
        if (audio || muted) return;
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          const context = new AudioContext();
          const master = context.createGain();
          master.gain.value = .045;
          master.connect(context.destination);
          const engine = context.createOscillator();
          const engineGain = context.createGain();
          engine.type = 'sawtooth';
          engine.frequency.value = 58;
          engineGain.gain.value = 0;
          engine.connect(engineGain).connect(master);
          engine.start();
          audio = { context, master, engine, engineGain };
        } catch { audio = null; }
      }

      function updateAudio() {
        if (!audio) return;
        try {
          const moving = status === 'playing' && !paused ? Math.min(1, Math.abs(player.speed) * 7) : 0;
          audio.engine.frequency.setTargetAtTime(54 + moving * 26 + (blowerTime > 0 ? 34 : 0), audio.context.currentTime, .06);
          audio.engineGain.gain.setTargetAtTime(muted ? 0 : moving * .72, audio.context.currentTime, .08);
        } catch {}
      }

      function setMuted(value) {
        muted = Boolean(value);
        if (!muted) {
          try {
            createAudio();
            audio?.context.resume?.().catch?.(() => {});
          } catch {}
        }
      }

      function tankCapacity() { return 100 * (1 + upgrades.tank * .25); }
      function maxSpeed() { return .185 * (1 + upgrades.speed * .14); }
      function plowRadius() { return .036 * (1 + upgrades.plow * .22); }
      function saltDuration() { return upgrades.salt > 0 ? 10 + upgrades.salt * 5 : 0; }
      function currentSnowRate() { return .0105 + (round - 1) * .0032 + Math.max(0, Math.sin(elapsed * .28)) * .003; }

      function indexAt(nx, ny) {
        const x = Math.max(0, Math.min(GRID - 1, Math.floor(nx * GRID)));
        const y = Math.max(0, Math.min(GRID - 1, Math.floor(ny * GRID)));
        return y * GRID + x;
      }

      function isRoad(nx, ny) {
        return ROAD_LINES.some(v => Math.abs(nx - v) < ROAD_HALF || Math.abs(ny - v) < ROAD_HALF);
      }

      function clearSnowAt(nx, ny, radius, strength, saltSeconds = 0) {
        const minX = Math.max(0, Math.floor((nx - radius) * GRID));
        const maxX = Math.min(GRID - 1, Math.ceil((nx + radius) * GRID));
        const minY = Math.max(0, Math.floor((ny - radius) * GRID));
        const maxY = Math.min(GRID - 1, Math.ceil((ny + radius) * GRID));
        let cleared = 0;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const idx = y * GRID + x;
            if (!roadMask[idx]) continue;
            const cx = (x + .5) / GRID;
            const cy = (y + .5) / GRID;
            const dx = cx - nx;
            const dy = cy - ny;
            if (dx * dx + dy * dy > radius * radius) continue;
            const before = snow[idx];
            snow[idx] = Math.max(0, before - strength);
            cleared += before - snow[idx];
            if (saltSeconds > 0) salt[idx] = Math.max(salt[idx], saltSeconds);
          }
        }
        clearedTotal += cleared;
        score += cleared * 18;
      }

      function buildingSnow(building) {
        const cx = Math.floor(building.doorX * GRID);
        const cy = Math.floor(building.doorY * GRID);
        let total = 0;
        let count = 0;
        for (let y = cy - 1; y <= cy + 1; y++) {
          for (let x = cx - 1; x <= cx + 1; x++) {
            if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
            const idx = y * GRID + x;
            if (!roadMask[idx]) continue;
            total += snow[idx];
            count++;
          }
        }
        return count ? total / count : 0;
      }

      function applyUpgrade(key) {
        resetInputs();
        upgrades[key]++;
        fuel = tankCapacity();
        blowerCharges = upgrades.blower;
        showMessage(`${UPGRADE_DEFS[key].name} installed`, 1.7);
        round++;
        roundTime = 0;
        dangerTime = 0;
        status = 'playing';
        upgradeOverlay.hidden = true;
        updateBlowerButton();
        lastTime = performance.now();
      }

      function chooseUpgrades() {
        const available = Object.keys(UPGRADE_DEFS).filter(key => upgrades[key] < 4);
        while (available.length < 3) available.push(...Object.keys(UPGRADE_DEFS));
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        const picks = [...new Set(available)].slice(0, 3);
        upgradeGrid.replaceChildren();
        picks.forEach(key => {
          const def = UPGRADE_DEFS[key];
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'upgrade-card';
          button.innerHTML = `<span class="upgrade-icon">${def.icon}</span><span class="upgrade-name">${def.name}</span><span class="upgrade-desc">${def.description(upgrades[key])}</span><span class="upgrade-level">Level ${upgrades[key]} → ${upgrades[key] + 1}</span>`;
          button.addEventListener('click', () => applyUpgrade(key), { once: true });
          upgradeGrid.append(button);
        });
        document.querySelector('#roundComplete').textContent = `Storm ${round} cleared`;
        status = 'between-rounds';
        upgradeOverlay.hidden = false;
        upgradeGrid.querySelector('button')?.focus();
      }

      function updateBlowerButton() {
        const unlocked = upgrades.blower > 0;
        blowerButton.classList.toggle('is-locked', !unlocked || blowerCharges <= 0);
        blowerChargesLabel.textContent = unlocked ? `${blowerCharges} charge${blowerCharges === 1 ? '' : 's'}` : 'Locked';
      }

      function resetGame() {
        snow.fill(.18);
        salt.fill(0);
        player.x = .5;
        player.y = .5;
        player.angle = -Math.PI / 2;
        player.speed = 0;
        for (const key of Object.keys(upgrades)) upgrades[key] = 0;
        fuel = 100;
        round = 1;
        roundTime = 0;
        elapsed = 0;
        score = 0;
        clearedTotal = 0;
        dangerTime = 0;
        accessibleCount = BUILDINGS.length;
        blowerTime = 0;
        blowerCharges = 0;
        status = 'playing';
        paused = false;
        warning.hidden = true;
        upgradeOverlay.hidden = true;
        gameOverOverlay.hidden = true;
        startOverlay.hidden = true;
        resetInputs();
        updateBlowerButton();
        showMessage('Storm 1 incoming', 1.5);
        createAudio();
        audio?.context.resume?.().catch?.(() => {});
        lastTime = performance.now();
      }

      function endGame() {
        status = 'game-over';
        player.speed = 0;
        resetInputs();
        const final = Math.max(0, Math.floor(score));
        const previous = safeGetBest();
        const best = Math.max(previous, final);
        if (best > previous) safeSetBest(best);
        document.querySelector('#finalScore').textContent = final.toLocaleString();
        document.querySelector('#bestScore').textContent = best.toLocaleString();
        gameOverOverlay.hidden = false;
        document.querySelector('#restartButton').focus();
      }

      function beginBlower() {
        if (upgrades.blower <= 0 || blowerCharges <= 0 || blowerTime > 0) return;
        blowerCharges--;
        blowerTime = 3.6;
        showMessage('Snow blower active', 1.1);
        updateBlowerButton();
      }

      function update(dt) {
        elapsed += dt;
        roundTime += dt;
        toastTime -= dt;
        if (toastTime <= 0) message.classList.remove('is-visible');

        const keyboardX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        const keyboardY = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
        let axisX = Math.abs(touchAxisX) > .04 ? touchAxisX : keyboardX;
        let axisY = Math.abs(touchAxisY) > .04 ? touchAxisY : keyboardY;
        const magnitude = Math.hypot(axisX, axisY);
        if (magnitude > 1) { axisX /= magnitude; axisY /= magnitude; }

        const actionDown = blowerHeld || keys.has('Space') || keys.has('Enter');
        if (actionDown && !lastBlowerHeld) beginBlower();
        lastBlowerHeld = actionDown;
        blowerButton.classList.toggle('is-active', actionDown && blowerTime > 0);

        const onRoad = isRoad(player.x, player.y);
        const capacity = tankCapacity();
        const reserve = fuel <= 0;
        const speedTarget = magnitude > .05 ? maxSpeed() * (onRoad ? 1 : .56) * (reserve ? .24 : 1) : 0;
        player.speed += (speedTarget - player.speed) * Math.min(1, dt * 7.5);
        if (magnitude > .05) {
          const desired = Math.atan2(axisY, axisX);
          let diff = ((desired - player.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          player.angle += diff * Math.min(1, dt * 10);
          player.x = Math.max(.025, Math.min(.975, player.x + axisX * player.speed * dt));
          player.y = Math.max(.025, Math.min(.975, player.y + axisY * player.speed * dt));
          if (!reserve) fuel = Math.max(0, fuel - dt * (3.7 + (onRoad ? 0 : 1.1)));
        }

        const garageDistance = Math.hypot(player.x - .5, player.y - .5);
        if (garageDistance < .065) {
          const before = fuel;
          fuel = Math.min(capacity, fuel + dt * 38);
          if (before < capacity - .5 && fuel >= capacity - .5) showMessage('Tank full', .9);
        }

        const frontX = player.x + Math.cos(player.angle) * .024;
        const frontY = player.y + Math.sin(player.angle) * .024;
        if (magnitude > .04) clearSnowAt(frontX, frontY, plowRadius(), dt * 2.9, saltDuration());

        if (blowerTime > 0) {
          blowerTime = Math.max(0, blowerTime - dt);
          clearSnowAt(player.x, player.y, .13 + upgrades.blower * .012, dt * 2.6, saltDuration());
        }

        const rate = currentSnowRate();
        for (let i = 0; i < snow.length; i++) {
          if (!roadMask[i]) continue;
          if (salt[i] > 0) salt[i] = Math.max(0, salt[i] - dt);
          const protection = salt[i] > 0 ? .38 : 1;
          const variation = .72 + ((i * 17 + round * 11) % 31) / 50;
          snow[i] = Math.min(1, snow[i] + rate * variation * protection * dt);
        }

        accessibleCount = 0;
        for (const building of BUILDINGS) {
          building.snow = buildingSnow(building);
          building.open = building.snow < .68;
          if (building.open) accessibleCount++;
        }

        const inaccessible = BUILDINGS.length - accessibleCount;
        if (inaccessible >= 4) {
          dangerTime += dt;
          const remaining = Math.max(0, 7 - dangerTime);
          warning.hidden = false;
          warning.textContent = `${inaccessible} buildings cut off. Reopen a route in ${remaining.toFixed(1)} seconds.`;
          if (dangerTime >= 7) endGame();
        } else {
          dangerTime = Math.max(0, dangerTime - dt * 1.5);
          warning.hidden = true;
        }

        score += dt * (accessibleCount * 2.2 + round * 1.3);
        if (roundTime >= ROUND_SECONDS && status === 'playing') chooseUpgrades();
      }

      function drawRoundedRect(x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
      }

      function drawRoads() {
        const roadW = Math.min(width, height) * ROAD_HALF * 2;
        ctx.fillStyle = '#455866';
        for (const line of ROAD_LINES) {
          ctx.fillRect(line * width - roadW / 2, 0, roadW, height);
          ctx.fillRect(0, line * height - roadW / 2, width, roadW);
        }
        ctx.strokeStyle = 'rgba(218, 234, 239, .26)';
        ctx.lineWidth = Math.max(1, Math.min(width, height) * .0025);
        ctx.setLineDash([Math.min(width, height) * .018, Math.min(width, height) * .018]);
        for (const line of ROAD_LINES) {
          ctx.beginPath(); ctx.moveTo(line * width, 0); ctx.lineTo(line * width, height); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, line * height); ctx.lineTo(width, line * height); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      function drawSnowGrid() {
        const cellW = width / GRID;
        const cellH = height / GRID;
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            const idx = y * GRID + x;
            if (!roadMask[idx] || snow[idx] < .025) continue;
            const amount = snow[idx];
            ctx.fillStyle = `rgba(236, 248, 252, ${Math.min(.96, amount * 1.02)})`;
            ctx.fillRect(x * cellW - .5, y * cellH - .5, cellW + 1, cellH + 1);
            if (salt[idx] > 0) {
              ctx.fillStyle = `rgba(114, 207, 236, ${Math.min(.18, salt[idx] * .012)})`;
              ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
            }
          }
        }
      }

      function drawBuilding(building) {
        const scale = Math.min(width, height);
        const isOpen = building.open !== false;
        const bw = scale * .075;
        const bh = scale * .058;
        const x = building.x * width - bw / 2;
        const y = building.y * height - bh / 2;
        ctx.save();
        ctx.globalAlpha = isOpen ? 1 : .68;
        ctx.fillStyle = 'rgba(9, 28, 40, .25)';
        drawRoundedRect(x + 3, y + 5, bw, bh, scale * .009); ctx.fill();
        ctx.fillStyle = building.color;
        drawRoundedRect(x, y, bw, bh, scale * .009); ctx.fill();
        ctx.fillStyle = '#e5f2f5';
        ctx.beginPath();
        ctx.moveTo(x - bw * .08, y + bh * .1);
        ctx.lineTo(x + bw * .5, y - bh * .48);
        ctx.lineTo(x + bw * 1.08, y + bh * .1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = isOpen ? '#ffe39a' : '#6b7e86';
        ctx.fillRect(x + bw * .38, y + bh * .42, bw * .24, bh * .58);
        ctx.restore();

        const doorX = building.doorX * width;
        const doorY = building.doorY * height;
        ctx.beginPath();
        ctx.arc(doorX, doorY, Math.max(4, scale * .009), 0, Math.PI * 2);
        ctx.fillStyle = isOpen ? '#8be07c' : '#ef655d';
        ctx.fill();
        ctx.strokeStyle = '#f7fcff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (!isOpen || Math.min(width, height) > 430) {
          ctx.fillStyle = isOpen ? 'rgba(10, 34, 47, .78)' : 'rgba(92, 31, 28, .88)';
          ctx.font = `900 ${Math.max(8, scale * .018)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(building.label, building.x * width, y - 5);
        }
      }

      function drawGarage() {
        const scale = Math.min(width, height);
        const size = scale * .11;
        const x = .5 * width;
        const y = .5 * height;
        ctx.save();
        ctx.fillStyle = 'rgba(89, 190, 216, .16)';
        ctx.beginPath(); ctx.arc(x, y, size * .68, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(170, 235, 250, .72)';
        ctx.lineWidth = Math.max(2, scale * .006);
        ctx.setLineDash([scale * .018, scale * .012]);
        ctx.beginPath(); ctx.arc(x, y, size * .64, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#235d76';
        drawRoundedRect(x - size * .48, y - size * .34, size * .96, size * .68, size * .1); ctx.fill();
        ctx.fillStyle = '#d9edf3';
        ctx.fillRect(x - size * .27, y - size * .08, size * .54, size * .42);
        ctx.fillStyle = '#143d52';
        ctx.font = `950 ${Math.max(8, scale * .018)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FUEL', x, y + size * .12);
        ctx.restore();
      }

      function drawPlayer() {
        const scale = Math.min(width, height);
        const x = player.x * width;
        const y = player.y * height;
        const length = scale * .047;
        const bodyW = scale * .033;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(player.angle);
        ctx.fillStyle = 'rgba(7, 21, 30, .28)';
        drawRoundedRect(-length * .36 + 3, -bodyW * .53 + 4, length, bodyW * 1.06, bodyW * .25); ctx.fill();
        ctx.fillStyle = '#b93638';
        drawRoundedRect(-length * .36, -bodyW * .53, length, bodyW * 1.06, bodyW * .25); ctx.fill();
        ctx.fillStyle = '#9ed8e7';
        ctx.fillRect(-length * .08, -bodyW * .43, length * .28, bodyW * .86);
        ctx.fillStyle = '#182931';
        ctx.fillRect(-length * .28, -bodyW * .68, length * .22, bodyW * .25);
        ctx.fillRect(-length * .28, bodyW * .43, length * .22, bodyW * .25);
        ctx.fillRect(length * .28, -bodyW * .68, length * .22, bodyW * .25);
        ctx.fillRect(length * .28, bodyW * .43, length * .22, bodyW * .25);
        const plowW = scale * plowRadius() * 1.55;
        ctx.fillStyle = '#f0a22e';
        ctx.beginPath();
        ctx.moveTo(length * .58, -plowW);
        ctx.lineTo(length * .78, -plowW * .82);
        ctx.lineTo(length * .78, plowW * .82);
        ctx.lineTo(length * .58, plowW);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffe08e';
        ctx.lineWidth = Math.max(1.5, scale * .004);
        ctx.stroke();
        if (blowerTime > 0) {
          ctx.strokeStyle = `rgba(218, 247, 255, ${.35 + Math.sin(elapsed * 18) * .15})`;
          ctx.lineWidth = scale * .012;
          ctx.beginPath(); ctx.arc(0, 0, scale * (.10 + upgrades.blower * .01), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }

      function drawSnowfall(dt) {
        ctx.fillStyle = 'rgba(247, 253, 255, .78)';
        for (const flake of snowflakes) {
          if (status === 'playing' && !paused) {
            flake.y += flake.speed * dt * (1 + round * .04);
            flake.x += (flake.drift + Math.sin(elapsed + flake.y * 9) * .0015) * dt;
            if (flake.y > 1.03) { flake.y = -.03; flake.x = Math.random(); }
            if (flake.x < -.03) flake.x = 1.03;
            if (flake.x > 1.03) flake.x = -.03;
          }
          ctx.beginPath();
          ctx.arc(flake.x * width, flake.y * height, flake.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function updateHud() {
        const capacity = tankCapacity();
        const fuelRatio = Math.max(0, Math.min(1, fuel / capacity));
        const accessRatio = accessibleCount / BUILDINGS.length;
        const roundRatio = Math.max(0, Math.min(1, roundTime / ROUND_SECONDS));
        hud.roundValue.textContent = `${round}`;
        hud.roundFill.style.transform = `scaleX(${roundRatio})`;
        hud.accessValue.textContent = `${Math.round(accessRatio * 100)}%`;
        hud.accessFill.style.transform = `scaleX(${accessRatio})`;
        hud.fuelValue.textContent = fuel <= 0 ? 'Reserve' : `${Math.round(fuelRatio * 100)}%`;
        hud.fuelFill.style.transform = `scaleX(${fuelRatio})`;
        hud.fuelFill.classList.toggle('is-low', fuelRatio < .3 && fuelRatio > 0);
        hud.fuelFill.classList.toggle('is-empty', fuelRatio <= 0);
        hud.scoreValue.textContent = Math.floor(score).toLocaleString();
        hud.scoreFill.style.transform = `scaleX(${Math.min(1, (score % 1000) / 1000)})`;
      }

      function draw(dt) {
        ctx.fillStyle = '#b9d5df';
        ctx.fillRect(0, 0, width, height);

        const cell = Math.min(width, height) * .055;
        ctx.fillStyle = '#dcebef';
        for (let y = 0; y < height + cell; y += cell) {
          for (let x = 0; x < width + cell; x += cell) {
            if (((x / cell + y / cell) | 0) % 2 === 0) ctx.fillRect(x, y, cell, cell);
          }
        }

        drawRoads();
        drawSnowGrid();
        drawGarage();
        BUILDINGS.forEach(drawBuilding);
        drawPlayer();
        drawSnowfall(dt);
        updateHud();
      }

      function frame(now) {
        const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;
        if (status === 'playing' && !paused) update(dt);
        draw(dt);
        updateAudio();
        animationId = requestAnimationFrame(frame);
      }

      function onKeyDown(event) {
        if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(event.code)) event.preventDefault();
        keys.add(event.code);
      }

      function onKeyUp(event) { keys.delete(event.code); }

      function moveJoystick(event) {
        if (touchPointer !== event.pointerId || !touchOrigin) return;
        const dx = event.clientX - touchOrigin.x;
        const dy = event.clientY - touchOrigin.y;
        const max = 42;
        const distance = Math.hypot(dx, dy) || 1;
        const scale = distance > max ? max / distance : 1;
        const sx = dx * scale;
        const sy = dy * scale;
        touchAxisX = sx / max;
        touchAxisY = sy / max;
        joystick.style.setProperty('--stick-x', `${sx}px`);
        joystick.style.setProperty('--stick-y', `${sy}px`);
      }

      joystick.addEventListener('pointerdown', event => {
        event.preventDefault();
        touchPointer = event.pointerId;
        touchOrigin = { x: event.clientX, y: event.clientY };
        joystick.setPointerCapture?.(event.pointerId);
      });
      joystick.addEventListener('pointermove', moveJoystick);
      const releaseJoystick = event => {
        if (touchPointer !== null && event.pointerId !== touchPointer) return;
        touchPointer = null;
        touchOrigin = null;
        touchAxisX = 0;
        touchAxisY = 0;
        joystick.style.setProperty('--stick-x', '0px');
        joystick.style.setProperty('--stick-y', '0px');
      };
      joystick.addEventListener('pointerup', releaseJoystick);
      joystick.addEventListener('pointercancel', releaseJoystick);
      joystick.addEventListener('lostpointercapture', releaseJoystick);

      blowerButton.addEventListener('pointerdown', event => {
        event.preventDefault();
        blowerHeld = true;
        blowerButton.setPointerCapture?.(event.pointerId);
      });
      const releaseBlower = () => { blowerHeld = false; blowerButton.classList.remove('is-active'); };
      blowerButton.addEventListener('pointerup', releaseBlower);
      blowerButton.addEventListener('pointercancel', releaseBlower);
      blowerButton.addEventListener('lostpointercapture', releaseBlower);

      document.querySelector('#startButton').addEventListener('click', resetGame);
      document.querySelector('#restartButton').addEventListener('click', resetGame);
      addEventListener('keydown', onKeyDown, { passive: false });
      addEventListener('keyup', onKeyUp);
      addEventListener('blur', resetInputs);
      addEventListener('pagehide', resetInputs);
      document.addEventListener('visibilitychange', () => { if (document.hidden) resetInputs(); });
      addEventListener('escapee:pause', resetInputs);
      addEventListener('resize', resize);
      window.visualViewport?.addEventListener('resize', resize);
      addEventListener('orientationchange', () => setTimeout(resize, 100));

      window.EscapeeGame = {
        restart: resetGame,
        pause: () => { paused = true; resetInputs(); },
        resume: () => { paused = false; lastTime = performance.now(); },
        setMuted,
        getStatus: () => status
      };

      setupRoadMask();
      resize();
      updateBlowerButton();
      draw(0);
      cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(frame);
    })();
