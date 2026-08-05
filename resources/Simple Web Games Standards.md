# Simple Web Games Standards

Use this checklist when designing or reviewing every game in this project.

## Universal behavior

- Fill the usable browser viewport without a permanent navigation bar.
- Show one small floating pause button.
- Pause menu: Resume, Restart, Sound, High Scores, Full screen, Home.
- Home asks for confirmation during an active run.
- Both portrait and landscape must remain playable.
- Desktop keyboard and mobile touch controls are both required.

## D1 high scores

- D1 is the only authoritative score store. Never store scores, leaderboards, initials, ranks, or personal-best values in local storage.
- Remove recognized legacy local score keys when the shared score runtime loads.
- Identify every score by the game’s lowercase URL slug.
- Check D1 qualification before asking for initials.
- Every valid score qualifies while fewer than ten scores exist for that game.
- Once ten scores exist, only a score strictly higher than the current tenth-place score qualifies. Earlier records win ties.
- Ask qualifying players for exactly three uppercase letters or numbers.
- Do not remember or prefill initials between runs.
- The player may edit initials only before Save Score.
- Saved game, initials, score, display text, record ID, and server timestamp are permanent.
- No public edit, overwrite, correction, or delete controls are permitted.
- Recheck qualification during POST because the cutoff may change before saving.
- Retain only the top ten rows per game.
- A failed qualification or save must never fall back to local storage.
- Prevent duplicate completion submissions.

A scored game must submit its authoritative final numeric score once from its game-over function:

```js
window.EscapeeScores.submit(finalScore, {
  label: 'Final score',
  display: `${finalScore.toLocaleString()} points`
});
```

Games with compound results may pass `sortValue` for numeric ranking and a separate readable display.

API behavior:

- `GET /api/scores?game=<slug>` returns one game’s top ten.
- `GET /api/scores?game=<slug>&action=qualify&score=<number>` checks whether initials should be requested.
- `GET /api/scores?action=all` returns all game boards for the arcade page.
- `POST /api/scores` rechecks qualification and inserts one permanent record.
- `PUT`, `PATCH`, and public `DELETE` are forbidden.

## End-of-run presentation

- Do not prompt for initials when the score does not qualify.
- A successful saved score must show the full top ten with the new row highlighted.
- Keep the leaderboard visible until the player chooses Play Again or Home.
- If a score loses qualification before saving, show the updated board and explain that the cutoff changed.
- D1 errors must clearly state that nothing was recorded.
- High Scores must be available from every game’s pause menu.
- The arcade must also provide a site-wide `/high-scores/` page with one board per scored game.

## Shared runtime and caching

- Every published game must receive the universal runtime, D1 score client, and universal stylesheet.
- Shared runtime asset URLs must be versioned or content-hashed whenever behavior changes.
- Scored games must not silently omit their completion hook.
- The build should fail when required score integration is missing.

## Responsive mobile rules

- Include `viewport-fit=cover`.
- Use `100dvh` or the shared visual-viewport value, not raw `100vh` alone.
- Keep HUD and controls inside safe areas.
- Reflow portrait and landscape layouts instead of shrinking the desktop layout.
- Use touch targets of at least 48 by 48 pixels.
- Prevent page scrolling and overscroll during play.

## Reliability and accessibility

- Audio, storage, network, D1, and fullscreen failure must never block gameplay.
- Pause when hidden, backgrounded, or interrupted and never auto-resume.
- Clear keyboard, joystick, and action-button state after interruption.
- Restart must not create another animation loop.
- Label icon-only controls and score fields.
- Keep pause, qualification, and leaderboard interfaces keyboard usable.
- Communicate loading, success, failure, and nonqualification without relying only on color.

## Pre-publish test

- Complete a run with zero through nine existing rows and confirm initials entry appears.
- Confirm a score higher than tenth place prompts when ten rows exist.
- Confirm a score equal to or below tenth place does not prompt.
- Confirm initials begin blank and accept exactly three letters or numbers.
- Confirm successful save shows the updated board until Play Again or Home.
- Confirm one game’s scores never appear in another game.
- Confirm old local score and initials keys are removed and cannot affect qualification.
- Confirm failed D1 requests create no local fallback.
- Confirm High Scores works from the pause menu and `/high-scores/`.
- Test small portrait, phone landscape, tablet, and desktop.
