# Neon Tac

Retro arcade tic-tac-toe. Static HTML, CSS, and JavaScript: open the site from `index.html` on any static host, including GitHub Pages. There is no build step.

## How to play

1. Follow the single **PRESS START** link.
2. Choose a mode on the next screen: **1P EASY**, **1P HARD**, or **2P**.
3. You play X and go first against the computer. In 2P, X and O share the same board.
4. Place a mark with the mouse, a tap, or the keyboard. Arrow keys move the amber cursor. Enter places a mark.
5. Three in a row lights that line and names the winner. A full board with no winner shows **DRAW**.
6. The board locks when the game ends. **RESTART** clears it in one click or tap and keeps the same mode.
7. **FULL** toggles fullscreen. Esc leaves fullscreen and the button updates with it. The control is hidden where the Fullscreen API is missing, including iPhone Safari. Install the page to an iPhone home screen (Share, then Add to Home Screen) and it opens fullscreen.
8. **SND** / **OFF** mutes the 8-bit sounds. The choice is stored in this browser. Audio starts only after the first click, tap, or key press.

Hard mode plays perfect minimax and does not lose. Easy mode picks a random legal move about half the time, so it can be beaten.

Local preview needs a static server because the page uses ES modules:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Tests

No dependencies to install.

```bash
node --test
```

`npm test` runs the same command.

## GitHub Pages

Pages deploys with GitHub Actions. The workflow is `.github/workflows/pages.yml`: it runs on every push to `main` and from the Actions tab (**Run workflow**).

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

No build command. The workflow copies the files the game loads into `_site/` and uploads that directory, so tests and other repo files are not published. The site is served under `/retro-tic-tac-toe/`. Styles, scripts, the font, and icons use relative paths, and the web app manifest sets `start_url` and `scope` to `./`, so they resolve on that path.

The pixel font is [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), licensed under the SIL Open Font License (see `fonts/OFL.txt`), with Courier New as a fallback.
