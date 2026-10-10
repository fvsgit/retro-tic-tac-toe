---
name: verify-tic-tac-toe
description: Drive Neon Tac in Chromium, Firefox, and WebKit and print PASS, FAIL, or HUMAN for all 16 acceptance criteria. Use after any change in this repo, before a pull request, or when a criterion looks broken.
---

# Verify Neon Tac

The player-facing app is the static page served the way GitHub Pages serves it, under `/retro-tic-tac-toe/`. Criteria live in `docs/criteria.md`. The runner is `tests/e2e/verify.mjs`.

## Launch

From the repo root:

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run verify
```

`npm run verify` builds `_site` with the same file list as `.github/workflows/pages.yml`, serves that directory at `http://127.0.0.1:<port>/retro-tic-tac-toe/`, and exits 0 when no criterion is FAIL. HUMAN does not fail the run.

The RETRO screenshots come from a git worktree of the base commit, not from this checkout. Set `VERIFY_BASE_REF` to a commit SHA or ref. The default is `origin/main`. The run throws if that commit is HEAD.

Ready when the server accepts a connection and `index.html` returns 200. The script closes the server when the report is written.

## Doctor

```bash
node tests/e2e/verify.mjs --doctor
```

Doctor checks that the Pages copy list matches `SITE_FILES`, that the three Playwright browsers are installed, and that the base commit is a different SHA from HEAD. It does not click the game.

## Drive

Open `/retro-tic-tac-toe/` in a fresh context. RETRO is the default. SCI-FI is `localStorage['neon-tac-theme'] = 'sci-fi'` set with `addInitScript` before `goto`.

Stable handles:

- `#start-link` is PRESS START.
- `[data-mode="easy"]`, `[data-mode="hard"]`, `[data-mode="pvp"]` choose the match.
- `.cell[data-index="0"]` through `.cell[data-index="8"]` are the board. Read `textContent` for X or O.
- `#status` is the turn, win, or DRAW line. `data-kind` is `turn`, `win`, or `draw`.
- `#restart`, `#mute`, `#fullscreen`, `#home`, `#theme-start`, `#theme-corner`.
- `#win-line.is-drawn` is the win stroke.
- `document.documentElement.dataset.theme` is `retro` or `sci-fi`.

Use `click` for mouse and `tap` for touch. Arrow keys move `.cell.cursor`. Enter places a mark when focus is not on a chrome button.

Wait until `#status` text is not `CPU` after a move against the computer. The computer waits 320ms.

Easy mode reads `Math.random`. Install the seed with `context.addInitScript(rngInitSource(2))` before `goto`. Do not add a seed argument to `js/game.js`. The unit test stubs `Math.random` in the test process and calls `easyMove` with its default.

## Evidence

The report is printed and saved at `tests/e2e/artifacts/report.txt`. Screenshots and pixel diffs, when a diff is not zero, are under `tests/e2e/artifacts/retro/`.

A criterion is PASS only when every recorded check for it passed. A failed check is FAIL. Criteria 6 and 15 stay HUMAN when their automated checks passed, because a person still has to press Esc, install to an iPhone home screen, and hear the two themes.

Drive the page. Do not set the board by writing `js/game.js` state. Assert the status text, cell text, and computed style the player can observe.

## Cleanup

The script closes the browsers and servers it opened and removes the base worktree. It leaves `tests/e2e/artifacts/report.txt` and the RETRO screenshots in place.

## Helpers

- `npm run verify` runs the full report.
- `node tests/e2e/verify.mjs --doctor` is the read-only check.
- `tests/e2e/rng.mjs` exports `rngInitSource(seed)` for the Playwright init script and `mulberry32` for the unit-test stub.
- `tests/e2e/site.mjs` exports `buildSite`, `SITE_FILES`, and `assertDistinctCommits`.

When the game changes, update `docs/criteria.md` and `features/` in the same change.
