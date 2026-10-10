# Neon Tac verification map

Read this index, then the feature file for the path you are proving. The commands are Playwright calls from `tests/e2e/verify.mjs`. The full run is `npm run verify`.

## Baseline preconditions

- Build with `buildSite` so the files match `.github/workflows/pages.yml`.
- Serve the parent of `retro-tic-tac-toe/` and open `/retro-tic-tac-toe/`.
- Use a fresh browser context. Do not reuse a player's profile.
- RETRO references come from a worktree of the base commit. Do not point the reference server at this checkout.
- Easy mode needs `addInitScript(rngInitSource(2))` before the page loads.

## Driving conventions

- Prefer `#start-link`, `[data-mode]`, `.cell[data-index]`, `#status`, `#restart`, `#mute`, `#fullscreen`, `#theme-start`, and `#theme-corner`.
- Read the board from cell text and the result from `#status`.
- Wait until `#status` is not `CPU` before the next human move.
- Keep `tests/e2e/artifacts/` after the run.

## Proof and skip reporting

- Record the action and the status or board that follows.
- A skipped entry point is not proof of a different entry point.
- Criteria 6 and 15 stay HUMAN after the automated checks pass.

## Features

- [Start and modes](./start-and-modes.md) covers PRESS START and the three mode buttons.
- [Play](./play.md) covers wins, draws, lock, restart, and keyboard.
- [Theme](./theme.md) covers the toggle, the kept match, and reload.
- [Sound and fullscreen](./sound-and-fullscreen.md) covers the first gesture, mute, and fullscreen.
