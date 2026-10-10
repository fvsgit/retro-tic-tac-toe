import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EASY_RANDOM_RATE,
  LINES,
  applyMove,
  createGame,
  easyMove,
  hardMove,
} from '../js/game.js';

const OTHER = { X: 'O', O: 'X' };

function play(state, index) {
  const result = applyMove(state, index);
  assert.equal(result.ok, true, `expected move ${index} to be legal`);
  return result.state;
}

function boardKey(state) {
  return state.board.map((cell) => cell ?? '.').join('');
}

function cellsExcept(line) {
  const used = new Set(line);
  const cells = [];
  for (let i = 0; i < 9; i += 1) {
    if (!used.has(i)) cells.push(i);
  }
  return cells;
}

function sortedKey(cells) {
  return [...cells].sort((a, b) => a - b).join(',');
}

const LINE_KEYS = new Set(LINES.map((line) => sortedKey(line)));

function nonWinningTriple(pool) {
  for (let a = 0; a < pool.length; a += 1) {
    for (let b = a + 1; b < pool.length; b += 1) {
      for (let c = b + 1; c < pool.length; c += 1) {
        const triple = [pool[a], pool[b], pool[c]];
        if (!LINE_KEYS.has(sortedKey(triple))) return triple;
      }
    }
  }
  throw new Error('no non-winning triple');
}

describe('winning lines', () => {
  for (const line of LINES) {
    test(`X wins on [${line.join(', ')}]`, () => {
      const fillers = cellsExcept(line);
      let state = createGame();
      state = play(state, line[0]);
      state = play(state, fillers[0]);
      state = play(state, line[1]);
      state = play(state, fillers[1]);
      state = play(state, line[2]);
      assert.equal(state.winner, 'X');
      assert.deepEqual(state.line, [...line]);
      assert.equal(state.draw, false);
    });

    test(`O wins on [${line.join(', ')}]`, () => {
      const blockers = nonWinningTriple(cellsExcept(line));
      let state = createGame();
      state = play(state, blockers[0]);
      state = play(state, line[0]);
      state = play(state, blockers[1]);
      state = play(state, line[1]);
      state = play(state, blockers[2]);
      state = play(state, line[2]);
      assert.equal(state.winner, 'O');
      assert.deepEqual(state.line, [...line]);
      assert.equal(state.draw, false);
    });
  }
});

test('a full board with no line is a draw', () => {
  // X O X
  // O X X
  // O X O
  let state = createGame();
  for (const index of [0, 1, 4, 8, 2, 6, 5, 3, 7]) {
    state = play(state, index);
  }
  assert.equal(state.draw, true);
  assert.equal(state.winner, null);
  assert.equal(state.line, null);
  assert.deepEqual(state.board, ['X', 'O', 'X', 'O', 'X', 'X', 'O', 'X', 'O']);
});

test('moves are rejected after a win or a draw until a new game', () => {
  let won = createGame();
  won = play(won, 0);
  won = play(won, 3);
  won = play(won, 1);
  won = play(won, 4);
  won = play(won, 2);
  assert.equal(won.winner, 'X');

  const afterWin = applyMove(won, 5);
  assert.equal(afterWin.ok, false);
  assert.equal(afterWin.reason, 'game-over');
  assert.equal(afterWin.state, won);

  let drawn = createGame();
  for (const index of [0, 1, 4, 8, 2, 6, 5, 3, 7]) {
    drawn = play(drawn, index);
  }
  const afterDraw = applyMove(drawn, 0);
  assert.equal(afterDraw.ok, false);
  assert.equal(afterDraw.reason, 'game-over');
  assert.equal(afterDraw.state, drawn);

  const restarted = createGame();
  assert.equal(applyMove(restarted, 0).ok, true);
});

test('hard never loses from any reachable position as either side', () => {
  const reachable = [];
  const seen = new Set();

  function walk(state) {
    const key = `${boardKey(state)}|${state.winner ?? ''}|${state.draw ? 'D' : state.turn}`;
    if (seen.has(key)) return;
    seen.add(key);
    reachable.push(state);
    if (state.winner || state.draw) return;
    for (let i = 0; i < 9; i += 1) {
      if (state.board[i] !== null) continue;
      walk(play(state, i));
    }
  }
  walk(createGame());

  const perfectMemo = new Map();

  function perfectScore(state) {
    const key = `${boardKey(state)}|${state.turn}|${state.winner ?? ''}|${state.draw ? 1 : 0}`;
    const cached = perfectMemo.get(key);
    if (cached !== undefined) return cached;

    let score;
    if (state.winner) score = -1;
    else if (state.draw) score = 0;
    else {
      score = -1;
      for (let i = 0; i < 9; i += 1) {
        if (state.board[i] !== null) continue;
        const next = play(state, i);
        const value = -perfectScore(next);
        if (value > score) score = value;
        if (score === 1) break;
      }
    }
    if (score === 0) score = 0;
    perfectMemo.set(key, score);
    return score;
  }

  function sideCanForceNonLoss(state, aiMark) {
    const score = perfectScore(state);
    if (state.turn === aiMark) return score >= 0;
    return score <= 0;
  }

  const lossMemo = new Map();

  function hardLoses(state, aiMark) {
    const key = `${boardKey(state)}|${state.turn}|${state.winner ?? ''}|${state.draw ? 1 : 0}|${aiMark}`;
    const cached = lossMemo.get(key);
    if (cached !== undefined) return cached;

    let loses;
    if (state.winner) loses = state.winner !== aiMark;
    else if (state.draw) loses = false;
    else if (state.turn === aiMark) {
      const move = hardMove(state.board, aiMark);
      assert.equal(state.board[move], null);
      const snapshot = state.board.slice();
      loses = hardLoses(play(state, move), aiMark);
      assert.deepEqual(state.board, snapshot);
    } else {
      loses = false;
      for (let i = 0; i < 9; i += 1) {
        if (state.board[i] !== null) continue;
        if (hardLoses(play(state, i), aiMark)) {
          loses = true;
          break;
        }
      }
    }
    lossMemo.set(key, loses);
    return loses;
  }

  const opening = createGame();
  assert.equal(perfectScore(opening), 0);
  for (const aiMark of ['X', 'O']) {
    assert.equal(sideCanForceNonLoss(opening, aiMark), true);
    assert.equal(hardLoses(opening, aiMark), false);
  }

  for (const state of reachable) {
    if (state.winner || state.draw) continue;
    for (const aiMark of ['X', 'O']) {
      if (!sideCanForceNonLoss(state, aiMark)) continue;
      assert.equal(
        hardLoses(state, aiMark),
        false,
        `${aiMark} lost from ${boardKey(state)} on ${state.turn}'s turn`,
      );
    }
  }
});

test('easy mode is random about half the time and otherwise matches hard', () => {
  assert.equal(EASY_RANDOM_RATE, 0.5);
  const board = ['X', 'X', null, null, null, null, null, null, 'O'];
  const winningMove = 2;

  let calls = 0;
  const randomRng = () => {
    calls += 1;
    return calls === 1 ? 0 : 0.99;
  };
  const randomMove = easyMove(board, 'X', randomRng);
  const legal = board.map((cell, index) => (cell === null ? index : -1)).filter((index) => index >= 0);
  assert.ok(legal.includes(randomMove));
  assert.notEqual(randomMove, winningMove);
  assert.notEqual(randomMove, hardMove(board, 'X'));
  assert.equal(hardMove(board, 'X'), winningMove);

  assert.equal(easyMove(board, 'X', () => EASY_RANDOM_RATE), hardMove(board, 'X'));
});

test('easy mode can lose to a determined opponent', () => {
  function opponentCanBeat(easyMark) {
    function search(state) {
      if (state.winner) return state.winner === OTHER[easyMark];
      if (state.draw) return false;
      if (state.turn === easyMark) {
        return search(play(state, easyMove(state.board, easyMark, () => 0)));
      }
      for (let i = 0; i < 9; i += 1) {
        if (state.board[i] !== null) continue;
        if (search(play(state, i))) return true;
      }
      return false;
    }
    return search(createGame());
  }

  assert.equal(opponentCanBeat('X'), true);
  assert.equal(opponentCanBeat('O'), true);
});
