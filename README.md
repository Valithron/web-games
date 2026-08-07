# Escapee Games

A lightweight browser-game portal for small games that work on desktop and mobile.

Production: `https://fun.skpfam.com`

## New game requirements

Before adding a game, read [`NEW_GAME_REQUIREMENTS.md`](./NEW_GAME_REQUIREMENTS.md).

It defines the required site-wide integration baseline for controls, mobile touch support, responsive viewport behavior, the universal pause menu, the `window.EscapeeGame` contract, D1-backed high scores, score-entry input locking, reliability, accessibility, and pre-publish testing.

Start from `games/_template` so those dependencies are accounted for from the outset.

## Cloudflare Pages

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`
- Pages Function: `functions/api/scores.js`
- Preferred D1 binding: `WEB_GAMES_SCORES`

The games themselves are static browser applications, but the site-wide top-10 high-score system uses the Pages Function and Cloudflare D1. Production must retain a working D1 binding for score qualification, initials entry, and leaderboards to work.

## Local development

```bash
npm run validate
npm run build
npm run dev
```

The development server runs at `http://localhost:4173` and listens on the local network so games can be tested on a phone.

## Add a game

1. Read `NEW_GAME_REQUIREMENTS.md`.
2. Copy `games/_template`.
3. Rename the copy using a lowercase kebab-case slug, such as `last-lantern`.
4. Update every field in `game.json`.
5. Change the page title and shell title in the game files.
6. Replace `thumbnail.svg` with a 4:3 thumbnail. SVG, PNG, and WebP are supported.
7. Build the game using relative asset paths or root paths that remain valid under `/<slug>/`.
8. Implement desktop keyboard and mobile touch controls together.
9. Expose the `window.EscapeeGame` pause/restart/resume hooks.
10. Wire the final score to `window.EscapeeScores.submit(...)`, unless the game explicitly uses `"scoreMode": "none"`.
11. Complete the pre-publish test in `NEW_GAME_REQUIREMENTS.md`.
12. Change `status` from `draft` to `published`.
13. Run `npm run validate` and `npm run build`.
14. Push to `main`.

The build automatically creates the homepage card, `games.json`, sitemap entry, and route at:

```text
https://fun.skpfam.com/<slug>/
```

No router or homepage edit is needed.

## Game manifest

```json
{
  "slug": "last-lantern",
  "title": "Last Lantern",
  "description": "Keep the lantern burning while creatures close in.",
  "category": "Survival",
  "tags": ["arcade", "waves", "upgrades"],
  "thumbnail": "thumbnail.webp",
  "desktopControls": ["WASD", "Arrow keys"],
  "mobileControls": ["Virtual joystick", "Touch buttons"],
  "orientation": "any",
  "sessionMinutes": "5–10 min",
  "published": "2026-08-05",
  "featured": true,
  "status": "published"
}
```

Folders beginning with `_` and manifests marked `draft` are excluded from the deployed catalog.

## Shared utilities and infrastructure

- `/shared/input.js` normalizes keyboard, pointer, joystick, and touch-button input.
- `/shared/storage.js` namespaces non-authoritative local storage by game slug and fails safely when storage is unavailable.
- `/shared/universal-game.js` provides the universal pause runtime, viewport handling, game integration hooks, and score UI shell.
- `/shared/universal-game.css` provides universal pause, confirmation, and score UI styling.
- `/shared/d1-scores.js` connects the score UI to the D1-backed top-10 service.
- `/shared/score-input-lock.js` prevents gameplay controls from firing while the player enters initials.
- `/functions/api/scores.js` provides the score qualification, insert-only persistence, and leaderboard API.
- `/scripts/postbuild-universal.mjs` injects the universal runtime into published games and rejects scored games that lack a score submission hook.

Games may use their own visual style and internal architecture as long as they satisfy `NEW_GAME_REQUIREMENTS.md`.