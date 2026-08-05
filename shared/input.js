export function createEscapeeInput({ surface = document.body, joystick = null, primary = null, secondary = null } = {}) {
  const state = { axisX: 0, axisY: 0, primary: false, secondary: false, pointerX: 0, pointerY: 0, pointerDown: false };
  const keys = new Set();
  let stickPointer = null;
  let stickOrigin = null;

  function refreshKeys() {
    state.axisX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    state.axisY = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    state.primary = keys.has('Space') || keys.has('Enter');
  }

  function reset() {
    keys.clear();
    stickPointer = null;
    stickOrigin = null;
    state.axisX = 0;
    state.axisY = 0;
    state.primary = false;
    state.secondary = false;
    state.pointerDown = false;
  }

  addEventListener('keydown', event => {
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code); refreshKeys();
  }, { passive: false });
  addEventListener('keyup', event => { keys.delete(event.code); refreshKeys(); });
  addEventListener('blur', reset);
  addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('escapee:pause', reset);

  surface.style.touchAction = 'none';
  surface.addEventListener('pointermove', event => {
    const rect = surface.getBoundingClientRect();
    state.pointerX = event.clientX - rect.left;
    state.pointerY = event.clientY - rect.top;
  });
  surface.addEventListener('pointerdown', event => { state.pointerDown = true; surface.setPointerCapture?.(event.pointerId); });
  const releaseSurface = () => { state.pointerDown = false; };
  surface.addEventListener('pointerup', releaseSurface);
  surface.addEventListener('pointercancel', releaseSurface);
  surface.addEventListener('lostpointercapture', releaseSurface);

  if (joystick) {
    joystick.addEventListener('pointerdown', event => { stickPointer = event.pointerId; stickOrigin = { x: event.clientX, y: event.clientY }; joystick.setPointerCapture?.(event.pointerId); });
    joystick.addEventListener('pointermove', event => {
      if (event.pointerId !== stickPointer || !stickOrigin) return;
      const dx = event.clientX - stickOrigin.x, dy = event.clientY - stickOrigin.y, max = 42;
      state.axisX = Math.max(-1, Math.min(1, dx / max));
      state.axisY = Math.max(-1, Math.min(1, dy / max));
    });
    const release = event => { if (stickPointer === null || event.pointerId === stickPointer) { stickPointer = null; stickOrigin = null; state.axisX = 0; state.axisY = 0; } };
    joystick.addEventListener('pointerup', release);
    joystick.addEventListener('pointercancel', release);
    joystick.addEventListener('lostpointercapture', release);
  }

  const bindButton = (element, key) => {
    if (!element) return;
    element.addEventListener('pointerdown', event => { event.preventDefault(); state[key] = true; element.setPointerCapture?.(event.pointerId); });
    const release = () => { state[key] = false; };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  };
  bindButton(primary, 'primary');
  bindButton(secondary, 'secondary');
  state.reset = reset;
  return state;
}
