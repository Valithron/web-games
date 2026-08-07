'use strict';

function update(dt) {
  if (state !== 'playing') return;
  screenShake = Math.max(0, screenShake - dt * 15);
  redFlash = Math.max(0, redFlash - dt * 2.8);
  lanternPulse += dt;
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  movePlayer(dt);
  drainFuel(dt);
  handleSpawning(dt);
  handleFuelSpawns(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateParticles(dt);
  cleanEntities();
  checkWaveEnd(dt);
  updateHud();
}

function movePlayer(dt) {
  let dx = joystick.x;
  let dy = joystick.y;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;

  player.moving = Math.hypot(dx, dy) > 0.08;
  if (player.moving) {
    const length = Math.max(1, Math.hypot(dx, dy));
    dx /= length;
    dy /= length;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.facing = Math.atan2(dy, dx);
    if (Math.random() < dt * 8) {
      particles.push({
        x: player.x - dx * 7,
        y: player.y - dy * 7,
        vx: -dx * (8 + Math.random() * 12) + (Math.random() - 0.5) * 14,
        vy: -dy * (8 + Math.random() * 12) + (Math.random() - 0.5) * 14,
        life: 0.35,
        maxLife: 0.35,
        size: 1 + Math.random() * 1.6,
        color: '#8a7157',
        alpha: 0.22
      });
    }
  }

  const pad = player.radius + 7;
  player.x = clamp(player.x, pad, W - pad);
  player.y = clamp(player.y, pad, H - pad);
}

function drainFuel(dt) {
  const movingTax = player.moving ? 1.035 : 1;
  player.fuel = Math.max(0, player.fuel - player.fuelDrain * player.fuelEfficiency * movingTax * dt);
}

function handleSpawning(dt) {
  if (!spawnQueue.length) return;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy(spawnQueue.shift());
    spawnTimer = Math.max(0.17, 0.68 - wave * 0.018);
  }
}

function handleFuelSpawns(dt) {
  pickupTimer -= dt;
  if (pickupTimer <= 0) {
    spawnFuelPickup(true);
    const urgency = clamp(player.fuel / player.maxFuel, 0, 1);
    pickupTimer = 6.6 + Math.random() * 3.2 - (1 - urgency) * 2.2;
  }
}

function getEffectiveLightRadius() {
  const ratio = clamp(player.fuel / player.maxFuel, 0, 1);
  const lowFuelShrink = 0.48 + ratio * 0.52;
  const flicker = player.fuel <= player.maxFuel * 0.22
    ? 0.94 + Math.sin(lanternPulse * 19) * 0.025 + (Math.random() - 0.5) * 0.035
    : 0.992 + Math.sin(lanternPulse * 5.3) * 0.008;
  return Math.max(48, player.lightRadius * lowFuelShrink * flicker);
}

function getEffectiveBurnDamage() {
  const ratio = clamp(player.fuel / player.maxFuel, 0, 1);
  return player.burnDamage * (ratio <= 0 ? 0.18 : 0.35 + ratio * 0.65);
}

function updateEnemies(dt) {
  const lightRadius = getEffectiveLightRadius();
  const damagePerSecond = getEffectiveBurnDamage();

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    enemy.hitGlow = Math.max(0, enemy.hitGlow - dt * 3.5);
    enemy.touchCooldown = Math.max(0, enemy.touchCooldown - dt);
    enemy.burstClock -= dt;
    enemy.burstTime = Math.max(0, enemy.burstTime - dt);
    enemy.flutterPhase += dt * 5.4;

    let dx = player.x - enemy.x;
    let dy = player.y - enemy.y;
    let distance = Math.max(0.001, Math.hypot(dx, dy));
    dx /= distance;
    dy /= distance;

    const tangentX = -dy * enemy.orbitSign;
    const tangentY = dx * enemy.orbitSign;
    let speedMultiplier = 1;

    if (enemy.behavior === 'orbit' && distance > 72) {
      const sway = Math.sin(lanternPulse * 2.2 + enemy.driftSeed) * 0.28;
      dx = dx * 0.74 + tangentX * (0.62 + sway);
      dy = dy * 0.74 + tangentY * (0.62 + sway);
    } else if (enemy.behavior === 'flutter') {
      const weave = Math.sin(enemy.flutterPhase + enemy.driftSeed) * 0.88;
      dx = dx * 0.84 + tangentX * weave;
      dy = dy * 0.84 + tangentY * weave;
      speedMultiplier = 0.9 + Math.abs(Math.sin(enemy.flutterPhase * 0.72)) * 0.28;
    } else if (enemy.behavior === 'lunge') {
      if (enemy.burstClock <= 0) {
        enemy.burstClock = 2.2 + Math.random() * 1.4;
        enemy.burstTime = 0.34;
        enemy.orbitSign *= -1;
      }
      if (enemy.burstTime > 0) {
        speedMultiplier = 1.85;
      } else if (distance > lightRadius * 0.72) {
        dx = dx * 0.9 + tangentX * 0.3;
        dy = dy * 0.9 + tangentY * 0.3;
      }
    } else if (enemy.behavior === 'charge') {
      if (enemy.burstClock <= 0 && distance < Math.max(340, lightRadius * 1.7)) {
        enemy.burstClock = 3.4 + Math.random() * 1.6;
        enemy.burstTime = 0.58;
      }
      speedMultiplier = enemy.burstTime > 0 ? 2.15 : 0.82;
    }

    const norm = Math.max(0.001, Math.hypot(dx, dy));
    dx /= norm;
    dy /= norm;

    enemy.x += dx * enemy.speed * speedMultiplier * dt;
    enemy.y += dy * enemy.speed * speedMultiplier * dt;

    distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const lightContact = lightRadius + enemy.radius * 0.35 - distance;
    if (lightContact > 0) {
      const depth = clamp(lightContact / Math.max(1, lightRadius * 0.55), 0.25, 1);
      enemy.hp -= damagePerSecond * depth * dt;
      enemy.hitGlow = Math.min(1, enemy.hitGlow + dt * 5);
      if (Math.random() < dt * (4 + depth * 8)) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: enemy.x + Math.cos(angle) * enemy.radius * 0.6,
          y: enemy.y + Math.sin(angle) * enemy.radius * 0.6,
          vx: (Math.random() - 0.5) * 20,
          vy: -14 - Math.random() * 28,
          life: 0.24 + Math.random() * 0.28,
          maxLife: 0.52,
          size: 1 + Math.random() * 2.3,
          color: Math.random() < 0.5 ? '#ffbd59' : '#e87935',
          alpha: 0.8
        });
      }
    }

    if (enemy.hp <= 0) {
      killEnemy(enemy);
      continue;
    }

    const collisionDistance = player.radius + enemy.radius;
    if (distance <= collisionDistance && enemy.touchCooldown <= 0 && player.invulnerable <= 0) {
      damagePlayer(enemy.damage);
      if (enemy.fuelDamage > 0) {
        const drained = Math.min(player.fuel, player.maxFuel * enemy.fuelDamage / 100);
        player.fuel = Math.max(0, player.fuel - drained);
        if (drained > 0) showToast(`Fuel -${Math.round(drained)}`);
      }
      enemy.touchCooldown = 0.7;
      const push = enemy.behavior === 'charge' ? 38 : 22;
      enemy.x -= dx * push;
      enemy.y -= dy * push;
    }
  }
}

function updatePickups(dt) {
  for (const pickup of pickups) {
    if (pickup.dead) continue;
    pickup.life -= dt;
    pickup.pulse += dt * 3.4;
    const distance = Math.hypot(player.x - pickup.x, player.y - pickup.y);
    if (distance <= player.radius + pickup.radius + 4) {
      pickup.dead = true;
      const before = player.fuel;
      player.fuel = Math.min(player.maxFuel, player.fuel + pickup.amount);
      score += Math.round(8 + (player.fuel - before) * 0.35);
      burst(pickup.x, pickup.y, '#ffc15f', 18, 95, 0.7);
      audio.tone(410, 0.12, 'sine', 0.15, 820);
      showToast(`Fuel +${Math.round(player.fuel - before)}`);
    } else if (pickup.life <= 0) {
      pickup.dead = true;
    }
  }
}

function damagePlayer(amount) {
  player.hp = Math.max(0, player.hp - amount);
  player.invulnerable = 0.58;
  redFlash = 0.7;
  screenShake = Math.min(13, screenShake + 7);
  audio.noise(0.07, 0.11);
  audio.tone(95, 0.16, 'sawtooth', 0.1, 55);
  if (player.hp <= 0) endGame();
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  score += enemy.reward;
  const heavy = enemy.radius >= 20;
  burst(enemy.x, enemy.y, enemy.eyeColor || '#db8c44', heavy ? 18 : 11, heavy ? 140 : 100, 0.72);
  screenShake = Math.min(6, screenShake + (heavy ? 2.2 : 0.7));
  if (heavy) audio.tone(72, 0.14, 'triangle', 0.08, 42);
}

function updateParticles(dt) {
  for (const mote of motes) {
    mote.y -= mote.drift * dt;
    if (mote.y < -4) { mote.y = H + 4; mote.x = Math.random() * W; }
  }
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.035, dt);
    p.vy *= Math.pow(0.035, dt);
    p.life -= dt;
  }
}

function burst(x, y, color, count, speed, alpha = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random() * 0.65);
    particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.25 + Math.random() * 0.38,
      maxLife: 0.63,
      size: 1.2 + Math.random() * 2.8,
      color,
      alpha
    });
  }
}

function cleanEntities() {
  enemies = enemies.filter(enemy => !enemy.dead);
  pickups = pickups.filter(pickup => !pickup.dead);
  particles = particles.filter(particle => particle.life > 0);
}

function checkWaveEnd(dt) {
  if (spawnQueue.length || enemies.length || state !== 'playing') {
    waveDelay = 0;
    return;
  }
  waveDelay += dt;
  if (waveDelay >= 0.8) showUpgrades();
}

function showUpgrades() {
  state = 'upgrade';
  score += wave * 25;
  upgradeChoices = shuffle([...upgrades]).slice(0, 3);
  els.upgradeCards.innerHTML = '';

  upgradeChoices.forEach((upgrade, index) => {
    const button = document.createElement('button');
    button.className = 'upgrade-card';
    button.type = 'button';
    button.innerHTML = `
      <span class="upgrade-number">${index + 1}</span>
      <strong>${upgrade.name}</strong>
      <span class="description">${upgrade.description}</span>
      <span class="current">Current: ${upgrade.current()}</span>
    `;
    button.addEventListener('click', () => selectUpgrade(index));
    els.upgradeCards.appendChild(button);
  });

  els.upgrades.classList.remove('hidden');
  audio.tone(330, 0.18, 'sine', 0.12, 660);
  updateHud();
}

function selectUpgrade(index) {
  if (state !== 'upgrade' || !upgradeChoices[index]) return;
  const upgrade = upgradeChoices[index];
  upgrade.apply();
  player.hp = Math.min(player.maxHp, player.hp + 8);
  els.upgrades.classList.add('hidden');
  state = 'playing';
  showToast(upgrade.name);
  audio.tone(480, 0.12, 'triangle', 0.13, 880);
  beginWave();
  lastTime = performance.now();
}

function pauseGame() {
  if (state !== 'playing' && state !== 'upgrade') return;
  pausedFrom = state;
  state = 'paused';
  keys.clear();
  resetJoystick();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = pausedFrom === 'upgrade' ? 'upgrade' : 'playing';
  lastTime = performance.now();
}

function endGame() {
  if (state === 'gameover') return;
  state = 'gameover';
  resetJoystick();
  keys.clear();
  els.gameOverCopy.textContent = `Wave ${wave}. Score ${score}.`;
  els.gameOver.classList.remove('hidden');
  if (!scoreSubmitted) {
    scoreSubmitted = true;
    window.EscapeeScores?.submit(score, {
      label: 'Lantern score',
      display: `${score.toLocaleString()} points · Wave ${wave}`
    });
  }
  audio.tone(190, 0.7, 'triangle', 0.14, 48);
}

function updateHud() {
  if (!player) return;
  els.wave.textContent = String(Math.max(1, wave));
  els.score.textContent = String(score);
  els.healthText.textContent = `${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)}`;
  els.fuelText.textContent = `${Math.ceil(player.fuel)} / ${Math.ceil(player.maxFuel)}`;
  els.healthFill.style.transform = `scaleX(${clamp(player.hp / player.maxHp, 0, 1)})`;
  els.fuelFill.style.transform = `scaleX(${clamp(player.fuel / player.maxFuel, 0, 1)})`;
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1250);
}
