import { applyMove, createGame, easyMove, hardMove, isGameOver } from './game.js';
import {
  audioUnlocked,
  isMuted,
  playCursor,
  playDraw,
  playMove,
  playUi,
  playWin,
  toggleMuted,
  unlockAudio,
} from './audio.js';

const HUMAN = 'X';
const CPU = 'O';
const AI_DELAY_MS = 320;

const screens = {
  start: document.querySelector('#screen-start'),
  mode: document.querySelector('#screen-mode'),
  game: document.querySelector('#screen-game'),
};
const startLink = document.querySelector('#start-link');
const statusEl = document.querySelector('#status');
const boardEl = document.querySelector('#board');
const winLine = document.querySelector('#win-line');
const restartBtn = document.querySelector('#restart');
const muteBtn = document.querySelector('#mute');
const fullscreenBtn = document.querySelector('#fullscreen');
const homeBtn = document.querySelector('#home');

const cells = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.dataset.index = String(index);
  boardEl.append(button);
  return button;
});

let screen = 'start';
let mode = 'pvp';
let game = createGame();
let cursor = 0;
let aiTimer = 0;

function show(name) {
  screen = name;
  for (const [key, element] of Object.entries(screens)) {
    element.hidden = key !== name;
  }
  if (name === 'start') startLink.focus();
}

function clearAi() {
  if (aiTimer) {
    window.clearTimeout(aiTimer);
    aiTimer = 0;
  }
}

function cpuTurn() {
  return mode !== 'pvp' && game.turn === CPU && !isGameOver(game);
}

function setCursor(index, announce) {
  if (index === cursor) {
    paintCursor();
    return;
  }
  cursor = index;
  paintCursor();
  if (announce) playCursor();
}

function paintCursor() {
  cells.forEach((cell, index) => {
    cell.classList.toggle('cursor', screen === 'game' && index === cursor);
  });
}

function statusKind() {
  if (game.winner) return 'win';
  if (game.draw) return 'draw';
  return 'turn';
}

function statusText() {
  if (game.winner === HUMAN) return mode === 'pvp' ? 'X WINS' : 'YOU WIN';
  if (game.winner === CPU) return mode === 'pvp' ? 'O WINS' : 'CPU WINS';
  if (game.draw) return 'DRAW';
  if (cpuTurn()) return 'CPU';
  if (mode === 'pvp') return `${game.turn} TURN`;
  return 'YOUR TURN';
}

function cellLabel(index) {
  const row = Math.floor(index / 3) + 1;
  const column = (index % 3) + 1;
  const mark = game.board[index] ?? 'empty';
  return `Row ${row} column ${column}, ${mark}`;
}

function render() {
  const winning = new Set(game.line ?? []);
  cells.forEach((cell, index) => {
    const mark = game.board[index];
    cell.textContent = mark ?? '';
    cell.classList.toggle('x', mark === 'X');
    cell.classList.toggle('o', mark === 'O');
    cell.classList.toggle('win', winning.has(index));
    cell.setAttribute('aria-label', cellLabel(index));
  });
  paintCursor();
  statusEl.textContent = statusText();
  statusEl.dataset.kind = statusKind();
  boardEl.classList.toggle('is-draw', game.draw);
  boardEl.classList.toggle('locked', isGameOver(game));

  if (game.line) {
    const [start, , end] = game.line;
    winLine.setAttribute('x1', String((start % 3) + 0.5));
    winLine.setAttribute('y1', String(Math.floor(start / 3) + 0.5));
    winLine.setAttribute('x2', String((end % 3) + 0.5));
    winLine.setAttribute('y2', String(Math.floor(end / 3) + 0.5));
    winLine.style.display = '';
  } else {
    winLine.style.display = 'none';
  }
}

function finishIfOver(previous) {
  if (game.winner && !previous.winner) playWin();
  else if (game.draw && !previous.draw) playDraw();
}

function place(index) {
  if (screen !== 'game' || cpuTurn() || aiTimer) return;
  const result = applyMove(game, index);
  if (!result.ok) return;
  const previous = game;
  game = result.state;
  playMove(previous.turn);
  render();
  finishIfOver(previous);
  if (!isGameOver(game) && mode !== 'pvp') scheduleCpu();
}

function scheduleCpu() {
  clearAi();
  aiTimer = window.setTimeout(() => {
    aiTimer = 0;
    if (screen !== 'game' || !cpuTurn()) return;
    const move = mode === 'hard' ? hardMove(game.board, CPU) : easyMove(game.board, CPU);
    if (move === null) return;
    const result = applyMove(game, move);
    if (!result.ok) return;
    const previous = game;
    game = result.state;
    setCursor(move, false);
    playMove(CPU);
    render();
    finishIfOver(previous);
  }, AI_DELAY_MS);
}

function startMatch(nextMode) {
  clearAi();
  mode = nextMode;
  game = createGame();
  cursor = 0;
  show('game');
  render();
}

function moveCursor(key) {
  const row = Math.floor(cursor / 3);
  const column = cursor % 3;
  if (key === 'ArrowLeft') setCursor(row * 3 + ((column + 2) % 3), true);
  if (key === 'ArrowRight') setCursor(row * 3 + ((column + 1) % 3), true);
  if (key === 'ArrowUp') setCursor(((row + 2) % 3) * 3 + column, true);
  if (key === 'ArrowDown') setCursor(((row + 1) % 3) * 3 + column, true);
}

function chromeControl(target) {
  return target instanceof Element && target.closest('button, a') && !target.closest('.cell');
}

cells.forEach((cell, index) => {
  cell.addEventListener('pointerdown', () => {
    unlockAudio();
  });
  cell.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse' && screen === 'game') setCursor(index, false);
  });
  cell.addEventListener('click', () => {
    unlockAudio();
    setCursor(index, false);
    place(index);
  });
});

startLink.addEventListener('click', (event) => {
  event.preventDefault();
  unlockAudio();
  playUi();
  show('mode');
});

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    unlockAudio();
    playUi();
    startMatch(button.dataset.mode);
  });
});

restartBtn.addEventListener('click', () => {
  unlockAudio();
  playUi();
  startMatch(mode);
});

homeBtn.addEventListener('click', () => {
  unlockAudio();
  clearAi();
  playUi();
  show('start');
});

document.addEventListener('keydown', (event) => {
  if (screen !== 'game') return;
  if (event.repeat) return;
  const arrows = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
    || event.key === 'ArrowUp' || event.key === 'ArrowDown';
  if (!arrows && event.key !== 'Enter') return;
  if (event.key === 'Enter' && chromeControl(event.target)) return;
  event.preventDefault();
  unlockAudio();
  if (arrows) moveCursor(event.key);
  else place(cursor);
});

function syncMute() {
  const muted = isMuted();
  muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  muteBtn.classList.toggle('is-muted', muted);
  muteBtn.textContent = muted ? 'OFF' : 'SND';
}

muteBtn.addEventListener('click', () => {
  unlockAudio();
  toggleMuted();
  syncMute();
  if (!isMuted()) playUi();
});

function fullscreenApi() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled;
  if (!request || !exit || enabled === false) return null;
  return {
    request,
    exit,
    active() {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    },
  };
}

function syncFullscreen() {
  const api = fullscreenApi();
  if (!api) {
    fullscreenBtn.hidden = true;
    return;
  }
  const active = Boolean(api.active());
  fullscreenBtn.hidden = false;
  fullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  fullscreenBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  fullscreenBtn.textContent = active ? 'EXIT' : 'FULL';
  fullscreenBtn.classList.toggle('is-on', active);
}

fullscreenBtn.addEventListener('click', async () => {
  unlockAudio();
  const api = fullscreenApi();
  if (!api) {
    syncFullscreen();
    return;
  }
  try {
    if (api.active()) await api.exit.call(document);
    else await api.request.call(document.documentElement);
  } catch {
    // Denied or unsupported in this document. The button state follows the event.
  }
  syncFullscreen();
});

document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);

syncMute();
syncFullscreen();
show('start');

// Touch and click above unlock audio. This catches keyboard use on the start screen
// before a control handler runs, without creating a context during load.
document.addEventListener('pointerdown', () => {
  if (!audioUnlocked()) unlockAudio();
}, { capture: true });
document.addEventListener('keydown', () => {
  if (!audioUnlocked()) unlockAudio();
}, { capture: true });
