'use strict';

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawGround();

  if (!player) return;

  const shakeX = screenShake ? (Math.random() - 0.5) * screenShake : 0;
  const shakeY = screenShake ? (Math.random() - 0.5) * screenShake : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawGroundMotes();
  drawFuelPickups(false);
  drawEnemies(false);
  drawParticles(false);
  drawWarmLight();
  drawDarkness();
  drawDistantMovement();
  drawFuelPickups(true);
  drawEnemies(true);
  drawParticles(true);
  drawPlayer();
  ctx.restore();

  if (redFlash > 0) {
    ctx.fillStyle = `rgba(152, 25, 22, ${redFlash * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawGround() {
  const gradient = ctx.createRadialGradient(W * 0.5, H * 0.48, 30, W * 0.5, H * 0.48, Math.hypot(W, H) * 0.66);
  gradient.addColorStop(0, '#17130e');
  gradient.addColorStop(0.42, '#0d0c09');
  gradient.addColorStop(1, '#050504');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = 'rgba(191, 160, 115, 0.018)';
  ctx.lineWidth = 1;
  const spacing = Math.max(42, Math.min(W, H) / 11);
  for (let x = -spacing; x < W + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(x * 0.03) * 22, H);
    ctx.stroke();
  }
  for (let y = -spacing; y < H + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + Math.cos(y * 0.04) * 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGroundMotes() {
  ctx.save();
  for (const mote of motes) {
    ctx.globalAlpha = mote.alpha;
    ctx.fillStyle = '#d3b27d';
    ctx.fillRect(mote.x, mote.y, mote.size, mote.size);
  }
  ctx.restore();
}

function drawWarmLight() {
  const radius = getEffectiveLightRadius();
  const ratio = clamp(player.fuel / player.maxFuel, 0, 1);
  ctx.save();
  const glow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, radius * 1.1);
  glow.addColorStop(0, `rgba(255, 211, 126, ${0.23 + ratio * 0.08})`);
  glow.addColorStop(0.34, `rgba(255, 174, 62, ${0.11 + ratio * 0.05})`);
  glow.addColorStop(0.76, 'rgba(191, 89, 24, 0.025)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(player.x - radius * 1.2, player.y - radius * 1.2, radius * 2.4, radius * 2.4);
  ctx.restore();
}

function drawDarkness() {
  const radius = getEffectiveLightRadius();
  ctx.save();
  const darkness = ctx.createRadialGradient(player.x, player.y, radius * 0.18, player.x, player.y, radius * 1.24);
  darkness.addColorStop(0, 'rgba(1,1,1,0.02)');
  darkness.addColorStop(0.52, 'rgba(1,1,1,0.12)');
  darkness.addColorStop(0.82, 'rgba(1,1,1,0.75)');
  darkness.addColorStop(1, 'rgba(1,1,1,0.975)');
  ctx.fillStyle = darkness;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function enemyVisibility(enemy) {
  const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  const radius = getEffectiveLightRadius();
  return clamp(1 - (distance - radius * 0.64) / (radius * 0.42), 0, 1);
}

function drawDistantMovement() {
  const radius = getEffectiveLightRadius();
  ctx.save();
  for (const enemy of enemies) {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < radius * 0.92 || distance > radius * 1.7) continue;
    const alpha = clamp(1 - Math.abs(distance - radius * 1.18) / (radius * 0.55), 0, 1) * 0.12;
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha * (0.7 + Math.sin(lanternPulse * 3 + enemy.driftSeed) * 0.3);
    ctx.fillStyle = enemy.eyeColor || '#d6a56d';
    const eyeGap = Math.max(2, enemy.radius * 0.28);
    ctx.beginPath();
    ctx.arc(enemy.x - eyeGap, enemy.y, 1.2, 0, Math.PI * 2);
    ctx.arc(enemy.x + eyeGap, enemy.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemies(litPass) {
  for (const enemy of enemies) {
    const visibility = enemyVisibility(enemy);
    if (litPass && visibility <= 0.02) continue;
    if (!litPass && visibility > 0.98) continue;

    const alpha = litPass ? visibility : 0.18;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = alpha;
    const burning = enemy.hitGlow > 0;
    ctx.shadowBlur = burning ? 16 : 0;
    ctx.shadowColor = '#e89145';
    ctx.fillStyle = burning ? '#b88357' : enemy.color;
    ctx.strokeStyle = burning ? '#efb263' : 'rgba(28,23,20,0.9)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (enemy.shape === 'spike') {
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5;
        const r = i % 2 ? enemy.radius * 0.48 : enemy.radius;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (enemy.shape === 'square') {
      ctx.roundRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2, 5);
    } else if (enemy.shape === 'diamond') {
      ctx.rotate(lanternPulse * 1.2 * enemy.orbitSign);
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(enemy.radius * 0.8, 0);
      ctx.lineTo(0, enemy.radius);
      ctx.lineTo(-enemy.radius * 0.8, 0);
      ctx.closePath();
    } else if (enemy.shape === 'wing') {
      const flap = 0.7 + Math.sin(enemy.flutterPhase) * 0.18;
      ctx.ellipse(-enemy.radius * 0.55, 0, enemy.radius * 0.7, enemy.radius * flap, -0.48, 0, Math.PI * 2);
      ctx.ellipse(enemy.radius * 0.55, 0, enemy.radius * 0.7, enemy.radius * flap, 0.48, 0, Math.PI * 2);
      ctx.moveTo(enemy.radius * 0.35, 0);
      ctx.arc(0, 0, enemy.radius * 0.36, 0, Math.PI * 2);
    } else if (enemy.shape === 'thorn') {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const r = i % 2 ? enemy.radius * 0.52 : enemy.radius;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (enemy.shape === 'antler') {
      ctx.arc(0, enemy.radius * 0.15, enemy.radius * 0.62, 0, Math.PI * 2);
    } else if (enemy.shape === 'maw') {
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.moveTo(enemy.radius * 0.48, 0);
      ctx.arc(0, 0, enemy.radius * 0.48, 0, Math.PI * 2, true);
    } else {
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    }
    ctx.fill('evenodd');
    ctx.stroke();

    if (enemy.shape === 'antler') {
      ctx.strokeStyle = burning ? '#efb263' : enemy.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.25, -enemy.radius * 0.25);
      ctx.lineTo(-enemy.radius * 0.55, -enemy.radius * 0.82);
      ctx.lineTo(-enemy.radius * 0.78, -enemy.radius * 1.05);
      ctx.moveTo(-enemy.radius * 0.52, -enemy.radius * 0.72);
      ctx.lineTo(-enemy.radius * 0.9, -enemy.radius * 0.65);
      ctx.moveTo(enemy.radius * 0.25, -enemy.radius * 0.25);
      ctx.lineTo(enemy.radius * 0.55, -enemy.radius * 0.82);
      ctx.lineTo(enemy.radius * 0.78, -enemy.radius * 1.05);
      ctx.moveTo(enemy.radius * 0.52, -enemy.radius * 0.72);
      ctx.lineTo(enemy.radius * 0.9, -enemy.radius * 0.65);
      ctx.stroke();
    }

    if (enemy.shape === 'maw') {
      ctx.strokeStyle = enemy.eyeColor;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const inner = enemy.radius * 0.46;
        const outer = enemy.radius * 0.7;
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle + 0.12) * outer, Math.sin(angle + 0.12) * outer);
      }
      ctx.stroke();
    }

    if (litPass && visibility > 0.38) {
      ctx.globalAlpha = alpha * 0.72;
      ctx.fillStyle = enemy.shape === 'maw' ? enemy.eyeColor : '#241b15';
      const eyeGap = Math.max(2, enemy.radius * 0.28);
      ctx.beginPath();
      ctx.arc(-eyeGap, -1, 1.2, 0, Math.PI * 2);
      ctx.arc(eyeGap, -1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (litPass && enemy.hp < enemy.maxHp && visibility > 0.42) {
      const healthRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      const width = enemy.radius * 2;
      ctx.globalAlpha = alpha * 0.68;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(-enemy.radius, -enemy.radius - 7, width, 2.5);
      ctx.fillStyle = '#e6a85f';
      ctx.fillRect(-enemy.radius, -enemy.radius - 7, width * healthRatio, 2.5);
    }
    ctx.restore();
  }
}

function drawFuelPickups(litPass) {
  const radius = getEffectiveLightRadius();
  for (const pickup of pickups) {
    const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    const visibility = clamp(1 - (distance - radius * 0.67) / (radius * 0.38), 0, 1);
    if (litPass && visibility <= 0.02) continue;
    if (!litPass && visibility > 0.98) continue;

    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.globalAlpha = litPass ? visibility : 0.11;
    const pulse = 1 + Math.sin(pickup.pulse) * 0.09;
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = litPass ? 20 : 0;
    ctx.shadowColor = '#ffb24f';
    ctx.fillStyle = '#d8913b';
    ctx.strokeStyle = '#ffdc8d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-7, -9, 14, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4f321b';
    ctx.fillRect(-3, -13, 6, 5);
    ctx.fillStyle = '#ffe2a0';
    ctx.fillRect(-3.5, -3, 7, 7);
    ctx.restore();
  }
}

function drawParticles(litPass) {
  const radius = getEffectiveLightRadius();
  ctx.save();
  for (const p of particles) {
    const distance = Math.hypot(p.x - player.x, p.y - player.y);
    const visible = distance <= radius * 1.1;
    if (litPass !== visible) continue;
    const lifeRatio = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = lifeRatio * (p.alpha ?? 1) * (litPass ? 1 : 0.12);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function drawPlayer() {
  const fuelRatio = clamp(player.fuel / player.maxFuel, 0, 1);
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.globalAlpha = player.invulnerable > 0 && Math.sin(lanternPulse * 28) > 0 ? 0.48 : 1;
  ctx.shadowBlur = 28 + fuelRatio * 14;
  ctx.shadowColor = '#ffb64f';
  ctx.fillStyle = 'rgba(255,190,81,0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(player.facing + Math.PI / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d9d1c4';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 9);
  ctx.lineTo(0, 6);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2b241d';
  ctx.beginPath();
  ctx.arc(0, -2, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(-player.facing - Math.PI / 2);
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#ffc15f';
  ctx.fillStyle = fuelRatio <= 0 ? '#8e4f28' : '#ffd27a';
  ctx.beginPath();
  ctx.roundRect(7, -7, 8, 13, 2.5);
  ctx.fill();
  ctx.fillStyle = '#4b2d17';
  ctx.fillRect(9, -10, 4, 4);
  ctx.restore();
}

function frame(time) {
  const dt = Math.min(0.035, Math.max(0, (time - lastTime) / 1000));
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function resetJoystick() {
  joystick.active = false;
  joystick.id = null;
  joystick.x = 0;
  joystick.y = 0;
  els.touchKnob.style.transform = 'translate(-50%, -50%)';
}

function updateJoystick(event) {
  const rect = els.touchStick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const max = rect.width * 0.31;
  const distance = Math.hypot(dx, dy);
  if (distance > max) {
    dx = dx / distance * max;
    dy = dy / distance * max;
  }
  joystick.x = dx / max;
  joystick.y = dy / max;
  els.touchKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

window.addEventListener('resize', resizeCanvas, { passive: true });
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 60), { passive: true });

window.addEventListener('keydown', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(key)) event.preventDefault();

  if (state === 'upgrade' && ['1', '2', '3'].includes(key)) {
    selectUpgrade(Number(key) - 1);
    return;
  }
  keys.add(key);
});

window.addEventListener('keyup', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

function clearInputState() {
  keys.clear();
  resetJoystick();
}

window.addEventListener('blur', () => {
  clearInputState();
  if (!window.__escapeeUniversalRuntime && (state === 'playing' || state === 'upgrade')) pauseGame();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  clearInputState();
  if (!window.__escapeeUniversalRuntime && (state === 'playing' || state === 'upgrade')) pauseGame();
});

window.addEventListener('pagehide', clearInputState);

els.touchStick.addEventListener('pointerdown', event => {
  if (state !== 'playing') return;
  joystick.active = true;
  joystick.id = event.pointerId;
  els.touchStick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
els.touchStick.addEventListener('pointermove', event => {
  if (!joystick.active || event.pointerId !== joystick.id) return;
  updateJoystick(event);
});
els.touchStick.addEventListener('pointerup', event => {
  if (event.pointerId === joystick.id) resetJoystick();
});
els.touchStick.addEventListener('pointercancel', resetJoystick);
els.touchStick.addEventListener('lostpointercapture', resetJoystick);

els.startButton.addEventListener('click', startGame);
els.restartButton.addEventListener('click', restartGame);
els.soundButton.addEventListener('click', () => audio.toggle());

window.EscapeeGame = {
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  getStatus() {
    if (state === 'start') return 'menu';
    if (state === 'upgrade') return 'between-rounds';
    if (state === 'gameover') return 'game-over';
    return state;
  }
};

updateSoundButton();
resizeCanvas();
resetGame();
requestAnimationFrame(frame);
