# Acceptance criteria

Neon Tac has 16 acceptance criteria. `npm run verify` prints PASS, FAIL, or HUMAN for each one.

PASS means the browser run proved the criterion. FAIL means a browser check failed. HUMAN means the automated checks passed and a person still has to confirm the part named in that criterion.

RETRO pixel checks compare this checkout with the base branch. The base is `origin/main` locally, the pull request base SHA in a pull request, and the previous commit on a push to main. The run refuses to compare a commit with itself.

## 1. Start screen

The start screen has one link, PRESS START. RETRO uses the Press Start 2P pixel font, neon cyan and magenta on black, and CRT scanlines. SCI-FI keeps the single link on a dark field. Criterion 14 checks the SCI-FI look.

Human: no

## 2. Mode choice

1P easy, 1P hard, and 2P are on the same screen.

Human: no

## 3. Difficulty

Hard never loses. Easy can be beaten. The easy check uses a fixed seed installed from the test, before the page loads.

Human: no

## 4. Wins and draws

Every row, column, and diagonal is detected and highlighted. A full board with no winner shows DRAW.

Human: no

## 5. Locked board

No moves land after the game ends until restart. Restart takes one click or tap.

Human: no

## 6. Fullscreen and layout

The fullscreen button works on desktop and mobile. The board stays square and on screen at the sizes the suite opens. On an iPhone the button is hidden, and a home-screen install opens fullscreen. Esc leaves fullscreen.

A person presses a real Esc key, and installs the page to an iPhone home screen.

Human: yes

## 7. Mute and the first gesture

Sound starts only after the first click, tap, or key press. The mute toggle persists in this browser.

Human: no

## 8. Input

The board accepts mouse, touch, and keyboard. Arrow keys move the cursor. Enter places a mark.

Human: no

## 9. Console

Current Chrome, Firefox, Safari, and Edge show no console errors. The suite runs Playwright Chromium, Firefox, and WebKit. Edge is the Chromium run.

Human: no

## 10. Both themes

Both themes pass criteria 1 to 9. RETRO screenshots match the base branch, captured in this same run.

Human: no

## 11. Theme controls

A theme toggle sits on the start screen and in the corner during play. Mouse, touch, and keyboard can use it. The corner button never covers the board.

Human: no

## 12. Theme keeps the match

Switching mid-game or after a win keeps the board, turn, mode, difficulty, and mute. The switch does not restart the match.

Human: no

## 13. Theme persistence

The switch is instant, survives reload, and does not flash the other theme.

Human: no

## 14. SCI-FI look

SCI-FI uses dark glass panels, cyan and magenta glow, and the Orbitron font loaded from the site. Win lines animate, and they stay still under reduced motion.

Human: no

## 15. Theme sounds

Each theme has its own sounds. Mute and the first-gesture rule are the same in both.

A person listens to a move in RETRO and in SCI-FI.

Human: yes

## 16. Marks and text

X and O are clearly distinct. Text is readable.

Human: no
