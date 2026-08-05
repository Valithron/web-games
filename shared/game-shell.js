const dispatch = name => window.dispatchEvent(new CustomEvent(`escapee:${name}`));

export function mountGameShell({ title = document.title, backHref = '/' } = {}) {
  const shell = document.createElement('nav');
  shell.className = 'escapee-shell';
  shell.setAttribute('aria-label', 'Game controls');
  shell.innerHTML = `<a class="escapee-shell__back" href="${backHref}">← Games</a><strong>${title}</strong><div class="escapee-shell__actions"><button data-action="restart" type="button">Restart</button><button data-action="mute" type="button" aria-pressed="false">Sound</button><button data-action="fullscreen" type="button">Full screen</button></div>`;
  document.body.prepend(shell);
  shell.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'fullscreen') {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
      return;
    }
    if (action === 'mute') {
      const muted = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(muted));
      button.textContent = muted ? 'Muted' : 'Sound';
      window.EscapeeGame?.setMuted?.(muted);
      dispatch('mute');
      return;
    }
    window.EscapeeGame?.restart?.();
    dispatch('restart');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { window.EscapeeGame?.pause?.(); dispatch('pause'); }
    else { window.EscapeeGame?.resume?.(); dispatch('resume'); }
  });
  return shell;
}
