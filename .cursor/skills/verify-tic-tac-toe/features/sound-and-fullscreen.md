# Sound and fullscreen

Audio starts on the first gesture. Fullscreen is a button when the API exists, and it is hidden when the API does not.

## Sub-features

- `first-gesture` leaves `AudioContext` unconstructed until the first click.
- `mute` stores OFF across reload and plays no further oscillators.
- `waves` use square in RETRO and sine in SCI-FI.
- `fullscreen` enters and leaves on the button.
- `iphone` hides the button when the Fullscreen API is missing.
- `board` stays square and inside the viewport.

## How to get to it (user POV)

- Load the page and do nothing. No sound plays.
- Click PRESS START. Later clicks can play.
- Choose SND to mute. Reload. The button still reads OFF.
- Choose FULL. Choose it again to leave.
- On an iPhone, FULL is absent. Add to Home Screen opens fullscreen.

## Driving it with Playwright

Preconditions:

- The audio context was wrapped with the spy init script before `goto`.
- `window.__ac` starts at 0 and `window.__waves` collects oscillator types.

- **First gesture.** Read `__ac` before any click. It is 0. Click `#start-link`. It is 1. Repeat in SCI-FI.
- **Waves.** In RETRO, oscillators created before the theme switch are `square`. After `#theme-corner`, new ones are `sine`. In a SCI-FI context, they are `sine` from the first click.
- **Mute.** Click `#mute`. Text is OFF. Another move appends no waves. Reload. Text is still OFF.
- **Fullscreen.** On desktop Chromium and Pixel 7, `#fullscreen` is visible. Click it. The document has a fullscreen element and the label is EXIT. Exit through the API. The label is FULL.
- **iPhone.** If `fullscreenEnabled` is false, `#fullscreen` is hidden. If Playwright WebKit still exposes the API, strip `fullscreenEnabled` with an init script and require the hidden button.
- **Board.** While a match is showing, `#board` width and height differ by at most 1px and the rectangle sits inside the viewport.

## Gotchas

- Playwright's Escape key is not the human Esc check. Criterion 6 stays HUMAN.
- Hearing the timbre is the human part of criterion 15. The wave type is the automated part.
- A home-screen install is not something this runner can finish. The manifest `display` value `fullscreen` is the automated part.
