# Theme

RETRO and SCI-FI share the match. The choice is stored in this browser and applied before the first paint.

## Sub-features

- `toggle` changes the theme from the start screen and from the corner button.
- `inputs` cover mouse, touch, and keyboard.
- `keep` leaves the board, turn, mode, difficulty, and mute in place.
- `persist` reloads on the saved theme without showing the other one.
- `retro-pixels` match the base commit.

## How to get to it (user POV)

- On the start screen, choose the theme button beside PRESS START.
- During a match, choose the theme button in the top corner.
- Reload the page.

## Driving it with Playwright

Preconditions:

- A fresh context for each direction you care about.
- RETRO shots of this checkout and of the base worktree use the same viewport, reduced motion, and moves 0, 1, 4, 2, 8.

- **Mouse.** Click `#theme-start`. `document.documentElement.dataset.theme` is `sci-fi`. Start 2P and click `#theme-corner`. The theme returns to `retro` and every cell is empty.
- **Keyboard.** Focus `#theme-start` and press Enter. Repeat on `#theme-corner` during 2P. Enter does not write X on the cursor cell.
- **Touch.** Tap those same buttons on the iPhone profile.
- **Overlap.** During a match, `#theme-corner` and `#board` rectangles do not intersect. Check 1280x800, Pixel 7, iPhone 13, 844x390, and 320x640.
- **Keep a hard match.** Mute, play cell 0, wait for the computer, then click `#theme-corner`. Board, status, and mute text stay. The next human move still gets a hard answer.
- **Keep a win.** Win the top row in 2P, then toggle. Status stays X WINS and the board stays locked.
- **Reload.** Set `neon-tac-theme` to `sci-fi`, reload with `waitUntil: 'commit'`, and read `data-theme` before and after load. Every sample is `sci-fi` and `--bg` is `#050814`.

## Gotchas

- Comparing this checkout to itself is a failed criterion 10, even when the pixels match.
- Sentinel's PNG files are not the reference. Capture the base commit in this run.
- The corner button is in the header. Check overlap only while `#screen-game` is visible.
