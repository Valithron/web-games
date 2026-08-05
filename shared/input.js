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

  addEventListener('keydown', event => {
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code); refreshKeys();
  }, { passive: false });
  addEventListener('keyup', event => { keys.delete(event.code); refreshKeys(); });

  surface.style.touchAction = 'none';
  surface.addEventListener('pointermove', event => {
    const rect = surface.getBoundingClientRect();
    state.pointerX = event.clientX - rect.left;
    state.pointerY = event.clientY - rect.top;
  });
  surface.addEventListener('pointerdown', event => { state.pointerDown = true; surface.setPointerCapture?.(event.pointerId); });
  surface.addEventListener('pointerup', () => { state.pointerDown = false; });
  surface.addEventListener('pointercancel', () => { state.pointerDown = false; });

  if (joystick) {
    joystick.addEventListener('pointerdown', event => { stickPointer = event.pointerId; stickOrigin = { x: event.clientX, y: event.clientY }; joystick.setPointerCapture(event.pointerId); });
    joystick.addEventListener('pointermove', event => {
      if (event.pointerId !== stickPointer || !stickOrigin) return;
      const dx = event.clientX - stickOrigin.x, dy = event.clientY - stickOrigin.y, max = 42;
      state.axisX = Math.max(-1, Math.min(1, dx / max));
      state.axisY = Math.max(-1, Math.min(1, dy / max));
    });
    const release = event => { if (event.pointerId === stickPointer) { stickPointer = null; stickOrigin = null; state.axisX = 0; state.axisY = 0; } };
    joystick.addEventListener('pointerup', release); joystick.addEventListener('pointercancel', release);
  }

  const bindButton = (element, key) => {
    if (!element) return;
    element.addEventListener('pointerdown', event => { event.preventDefault(); state[key] = true; element.setPointerCapture(event.pointerId); });
    element.addEventListener('pointerup', () => { state[key] = false; });
    element.addEventListener('pointercancel', () => { state[key] = false; });
  };
  bindButton(primary, 'primary'); bindButton(secondary, 'secondary');
  return state;
}
