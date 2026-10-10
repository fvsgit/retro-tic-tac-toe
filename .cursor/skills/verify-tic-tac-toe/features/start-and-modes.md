# Start and modes

The start screen offers one PRESS START link. The next screen offers 1P easy, 1P hard, and 2P together.

## Sub-features

- `start-link` shows a single PRESS START link.
- `retro-look` uses Press Start 2P, neon on black, and scanlines.
- `modes` shows 1P EASY, 1P HARD, and 2 PLAYERS on one screen.

## How to get to it (user POV)

- Open the site. The start screen is showing.
- Choose PRESS START.

## Driving it with Playwright

Preconditions:

- The page is at `/retro-tic-tac-toe/` and `network` has finished loading fonts.
- The context has not set `neon-tac-theme`, unless this pass is SCI-FI.

- **See the start screen.** Run `page.goto` and read `#start-link`. The only anchor is PRESS START, and its href is `#play`. `#screen-mode` and `#screen-game` are hidden.
- **RETRO look.** Read computed style. Body background is `rgb(5, 1, 10)`, body font includes Press Start 2P, and `.crt` background includes `repeating-linear-gradient`.
- **Open modes.** Click or tap `#start-link`. The three `[data-mode]` buttons are visible together with text 1P EASY, 1P HARD, and 2 PLAYERS.

## Gotchas

- SCI-FI does not use scanlines or Press Start 2P. Criterion 14 owns that look.
- The start link blinks unless the context sets `reducedMotion: 'reduce'`. RETRO screenshots require that setting, and they fail if the animation name is not `none`.
