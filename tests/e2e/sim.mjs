import assert from 'node:assert/strict';
import { applyMove, createGame, easyMove, hardMove, isGameOver } from '../../js/game.js';
import { mulberry32 } from './rng.mjs';

export const EASY_SEED = 2;

export const EASY_BOARD = ['O', '', 'X', 'O', 'X', '', 'X', '', ''];

export const HARD_GAMES = [
  {
    policy: 'pref',
    board: ['O', '', 'X', 'O', 'X', '', 'O', '', 'X'],
  },
  {
    policy: 'low',
    board: ['X', 'X', 'O', 'X', 'O', '', 'O', '', ''],
  },
  {
    policy: 'corners',
    board: ['X', 'O', 'X', '', 'O', '', 'X', 'O', ''],
  },
];

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const PREF = [4, 0, 2, 6, 8, 1, 3, 5, 7];
const CORNERS = [0, 2, 6, 8, 4, 1, 3, 5, 7];

export function winningMove(board, mark) {
  for (const line of LINES) {
    const marks = line.map((index) => board[index]);
    if (marks.filter((cell) => cell === mark).length === 2 && marks.includes('')) {
      return line[marks.indexOf('')];
    }
  }
  return null;
}

export const POLICIES = {
  pref(board) {
    return winningMove(board, 'X') ?? PREF.find((index) => board[index] === '');
  },
  low(board) {
    return board.findIndex((cell) => cell === '');
  },
  corners(board) {
    return CORNERS.find((index) => board[index] === '');
  },
};

function asText(board) {
  return board.map((cell) => cell ?? '');
}

export function withSeed(seed, run) {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return run();
  } finally {
    Math.random = original;
  }
}

function simulate(policyName, mover) {
  let state = createGame();
  for (let guard = 0; guard < 9 && !isGameOver(state); guard += 1) {
    const index = state.turn === 'X'
      ? POLICIES[policyName](asText(state.board))
      : mover(state);
    const result = applyMove(state, index);
    if (!result.ok) break;
    state = result.state;
  }
  return {
    board: asText(state.board),
    winner: state.winner,
    draw: state.draw,
  };
}

export function simulateEasy(seed = EASY_SEED) {
  return withSeed(seed, () => simulate('pref', (state) => easyMove(state.board, 'O')));
}

export function simulateHard(policyName) {
  const original = Math.random;
  Math.random = () => {
    throw new Error('hard mode called Math.random');
  };
  try {
    return simulate(policyName, (state) => hardMove(state.board, 'O'));
  } finally {
    Math.random = original;
  }
}

export function checkFixtures() {
  const original = Math.random;
  const easy = simulateEasy(EASY_SEED);
  assert.equal(Math.random, original);
  assert.equal(easy.winner, 'X');
  assert.equal(easy.draw, false);
  assert.deepEqual(easy.board, EASY_BOARD);

  for (const game of HARD_GAMES) {
    const result = simulateHard(game.policy);
    assert.equal(result.winner, 'O', game.policy);
    assert.deepEqual(result.board, game.board, game.policy);
  }
}
