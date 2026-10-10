import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { applyMove, createGame } from '../js/game.js';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  difficultyOf,
  readTheme,
  toggleThemeName,
  writeTheme,
} from '../js/theme.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
}

function play(state, index) {
  const result = applyMove(state, index);
  assert.equal(result.ok, true);
  return result.state;
}

function snapshotFrom(game, extras) {
  return {
    theme: 'retro',
    board: game.board,
    turn: game.turn,
    mode: extras.mode,
    difficulty: difficultyOf(extras.mode),
    muted: extras.muted,
    score: extras.score,
    winner: game.winner,
    line: game.line,
    draw: game.draw,
    game,
  };
}

function assertPlayUntouched(next, previous) {
  assert.equal(next.board, previous.board);
  assert.deepEqual(next.board, previous.board);
  assert.equal(next.turn, previous.turn);
  assert.equal(next.mode, previous.mode);
  assert.equal(next.difficulty, previous.difficulty);
  assert.equal(next.muted, previous.muted);
  assert.equal(next.score, previous.score);
  assert.deepEqual(next.score, previous.score);
  assert.equal(next.winner, previous.winner);
  assert.equal(next.line, previous.line);
  assert.equal(next.draw, previous.draw);
  assert.equal(next.game, previous.game);
  assert.equal(previous.theme, 'retro');
}

test('saved theme loads back after a reload', () => {
  const firstVisit = memoryStorage();
  assert.equal(readTheme(firstVisit), 'retro');
  assert.equal(writeTheme(firstVisit, 'sci-fi'), 'sci-fi');

  const reloaded = firstVisit;
  assert.equal(readTheme(reloaded), 'sci-fi');
  assert.equal(reloaded.getItem(THEME_STORAGE_KEY), 'sci-fi');

  writeTheme(reloaded, 'retro');
  assert.equal(readTheme(reloaded), 'retro');

  writeTheme(reloaded, 'neon');
  assert.equal(readTheme(reloaded), 'retro');
  assert.equal(reloaded.getItem(THEME_STORAGE_KEY), 'retro');
});

test('unreadable theme storage stays on retro', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readTheme(blocked), 'retro');
  assert.equal(writeTheme(blocked, 'sci-fi'), 'sci-fi');
  assert.equal(readTheme(memoryStorage({ [THEME_STORAGE_KEY]: '' })), 'retro');
});

test('switching theme mid-game leaves board, turn, mode, difficulty, mute, and score', () => {
  let game = createGame();
  game = play(game, 0);
  game = play(game, 4);
  const mid = snapshotFrom(game, {
    mode: 'hard',
    muted: true,
    score: { x: 2, o: 1 },
  });
  assert.equal(mid.turn, 'X');
  assert.equal(mid.winner, null);
  assert.equal(mid.difficulty, 'hard');
  assert.deepEqual(mid.board, ['X', null, null, null, 'O', null, null, null, null]);

  const next = applyTheme(mid, toggleThemeName(mid.theme));
  assert.equal(next.theme, 'sci-fi');
  assertPlayUntouched(next, mid);

  const back = applyTheme(next, 'retro');
  assert.equal(back.theme, 'retro');
  assert.equal(back.board, mid.board);
  assert.equal(back.turn, mid.turn);
  assert.equal(back.mode, 'hard');
  assert.equal(back.difficulty, 'hard');
  assert.equal(back.muted, true);
  assert.deepEqual(back.score, { x: 2, o: 1 });
});

test('switching theme after a win leaves board, turn, mode, difficulty, mute, and score', () => {
  let game = createGame();
  game = play(game, 0);
  game = play(game, 3);
  game = play(game, 1);
  game = play(game, 4);
  game = play(game, 2);
  const won = snapshotFrom(game, {
    mode: 'easy',
    muted: false,
    score: { x: 4, o: 2 },
  });
  assert.equal(won.winner, 'X');
  assert.deepEqual(won.line, [0, 1, 2]);
  assert.equal(won.turn, 'O');
  assert.equal(won.difficulty, 'easy');
  assert.equal(won.draw, false);

  const next = applyTheme(won, 'sci-fi');
  assert.equal(next.theme, 'sci-fi');
  assertPlayUntouched(next, won);
  assert.deepEqual(next.line, [0, 1, 2]);

  const pvp = snapshotFrom(game, {
    mode: 'pvp',
    muted: true,
    score: { x: 4, o: 2 },
  });
  assert.equal(pvp.difficulty, null);
  const pvpNext = applyTheme(pvp, 'sci-fi');
  assert.equal(pvpNext.mode, 'pvp');
  assert.equal(pvpNext.difficulty, null);
  assert.equal(pvpNext.muted, true);
  assert.equal(pvpNext.game, game);
});

test('the boot script reads the saved theme before the stylesheet', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const scriptAt = head.indexOf('localStorage.getItem("neon-tac-theme") === "sci-fi"');
  const cssAt = head.indexOf('href="css/style.css"');
  assert.equal(THEME_STORAGE_KEY, 'neon-tac-theme');
  assert.ok(scriptAt > -1, 'head script must read neon-tac-theme');
  assert.ok(cssAt > scriptAt, 'theme script must run before the stylesheet');
  assert.match(head, /documentElement\.setAttribute\("data-theme", theme\)/);
  assert.match(html, /<html lang="en" data-theme="retro">/);
});
