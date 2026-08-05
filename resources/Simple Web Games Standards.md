# Simple Web Games Standards

Use this checklist when designing or reviewing every game in this project.

## Universal behavior

- Full usable browser viewport, with no permanent navigation bar.
- One small floating pause button.
- Pause menu: Resume, Restart, Sound, Full screen, Home.
- Home asks for confirmation during an active run.
- Both portrait and landscape must remain playable.
- Desktop keyboard and mobile touch controls are both required.

## Responsive mobile rules

- Include `viewport-fit=cover`.
- Use `100dvh` or the shared visual-viewport value, not raw `100vh` alone.
- Keep HUD and controls inside safe areas.
- Reflow portrait and landscape layouts instead of shrinking the desktop layout.
- Use touch targets of at least 48 by 48 pixels.
- Prevent page scrolling and overscroll during play.
- Test small portrait and short landscape screens.

## Reliability rules

- Audio failure must never block gameplay.
- Storage failure must never block gameplay.
- Pause when hidden, backgrounded, or interrupted.
- Do not resume automatically when the player returns.
- Clear keyboard, joystick, and action-button state after interruption.
- Use one animation loop. Restart must not create another loop.
- Cap frame delta after interruptions.
- Catch rejected fullscreen and audio promises.

## Canvas rules

- Match backing resolution to displayed size.
- Cap device pixel ratio at 2 unless testing proves otherwise.
- Resize after browser-bar changes, rotation, fullscreen changes, and viewport changes.
- Keep important game objects and controls visible in both orientations.

## Accessibility

- Label icon-only buttons.
- Keep pause menus keyboard usable.
- Maintain readable contrast.
- Respect reduced-motion settings for nonessential animation.

## Pre-publish test

- Start with Web Audio unavailable.
- Start with local storage unavailable.
- Pause and resume.
- Cancel and accept Home confirmation.
- Restart repeatedly and verify only one loop runs.
- Interrupt a held touch control and verify it releases.
- Rotate during play.
- Test at 320 by 568, modern phone portrait, phone landscape, tablet, and desktop.
- Verify no menu or HUD overflows.
- Verify backgrounding pauses the game.
