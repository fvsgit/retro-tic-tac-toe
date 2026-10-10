# Play

A match highlights every winning line, shows DRAW on a full board, locks the board, and restarts in one control.

## Sub-features

- `lines` highlights each of the eight lines.
- `draw` shows DRAW with no highlighted cells.
- `lock` ignores clicks after the end.
- `restart` clears the board in one click.
- `keyboard` moves with arrows and places with Enter.
- `hard` ends in CPU WINS for the scripted policies.
- `easy` ends in YOU WIN for seed 2.

## How to get to it (user POV)

- Choose PRESS START, then 1P EASY, 1P HARD, or 2 PLAYERS.
- Place marks with the mouse, a tap, or the keyboard.

## Driving it with Playwright

Preconditions:

- Call `startMode` so `#screen-game` is visible.
- For easy mode, the context ran `rngInitSource(2)` before `goto`.

- **Win a line.** In 2P, play the line cell, a filler, the second line cell, a filler, and the third line cell. `#status` reads X WINS and `.cell.win` matches the line.
- **Draw.** Play indexes 0, 1, 4, 8, 2, 6, 5, 3, 7. `#status` reads DRAW.
- **Lock.** Click a cell after the end. The board text stays the same.
- **Restart.** Click `#restart` once. Every cell is empty and `#status` reads X TURN in 2P.
- **Keyboard.** Press ArrowRight, ArrowDown, ArrowLeft, ArrowUp, ArrowRight, Enter. Cell 1 reads X.
- **Hard.** Play the `pref`, `low`, and `corners` policies. `#status` reads CPU WINS and the board matches `HARD_GAMES`.
- **Easy.** Play the `pref` policy. `#status` reads YOU WIN and the board matches `EASY_BOARD`.

## Gotchas

- Wait until `#status` is not CPU. A fixed sleep races the 320ms computer delay.
- Do not pass a random function into `easyMove` from the page. The page must call `Math.random`, which the init script replaced.
- Hard mode must not see a stubbed `Math.random`. Give it a context with no seed script.
