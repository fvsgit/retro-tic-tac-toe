/** @typedef {'X' | 'O'} Mark */
/** @typedef {Mark | null} Cell */

/**
 * @typedef {object} GameState
 * @property {Cell[]} board
 * @property {Mark} turn
 * @property {Mark | null} winner
 * @property {number[] | null} line
 * @property {boolean} draw
 */

/** @type {readonly (readonly number[])[]} */
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Chance that easy mode picks a random legal move instead of minimax. */
export const EASY_RANDOM_RATE = 0.5;

/** @param {Mark} mark */
function other(mark) {
  return mark === 'X' ? 'O' : 'X';
}

/** @returns {GameState} */
export function createGame() {
  return {
    board: Array(9).fill(null),
    turn: 'X',
    winner: null,
    line: null,
    draw: false,
  };
}

/** @param {GameState} state */
export function isGameOver(state) {
  return state.winner !== null || state.draw;
}

/**
 * @param {readonly Cell[]} board
 * @returns {{ winner: Mark, line: number[] } | null}
 */
function findWin(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { winner: mark, line: [a, b, c] };
    }
  }
  return null;
}

/**
 * @param {GameState} state
 * @param {number} index
 * @returns {{ ok: true, state: GameState } | { ok: false, reason: string, state: GameState }}
 */
export function applyMove(state, index) {
  if (isGameOver(state)) {
    return { ok: false, reason: 'game-over', state };
  }
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    return { ok: false, reason: 'out-of-range', state };
  }
  if (state.board[index] !== null) {
    return { ok: false, reason: 'occupied', state };
  }

  const board = state.board.slice();
  board[index] = state.turn;
  const win = findWin(board);
  const draw = !win && board.every((cell) => cell !== null);
  return {
    ok: true,
    state: {
      board,
      turn: other(state.turn),
      winner: win ? win.winner : null,
      line: win ? win.line : null,
      draw,
    },
  };
}

/** @param {readonly Cell[]} board */
export function legalMoves(board) {
  const moves = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
}

/**
 * Score for `mark` on a board it just played, in plies from the search root.
 * Quicker wins score higher so the opponent cannot stall a forced win.
 * @param {Cell[]} board
 * @param {Mark} turn
 * @param {Mark} mark
 * @param {number} depth
 */
function minimax(board, turn, mark, depth) {
  const win = findWin(board);
  if (win) return win.winner === mark ? 10 - depth : depth - 10;
  const moves = legalMoves(board);
  if (moves.length === 0) return 0;

  let best = turn === mark ? -Infinity : Infinity;
  for (const move of moves) {
    board[move] = turn;
    const score = minimax(board, other(turn), mark, depth + 1);
    board[move] = null;
    if (turn === mark) best = Math.max(best, score);
    else best = Math.min(best, score);
  }
  return best;
}

/**
 * Perfect move for `mark`. Never loses from a position that can be held.
 * @param {readonly Cell[]} board
 * @param {Mark} mark
 * @returns {number | null}
 */
export function hardMove(board, mark) {
  const moves = legalMoves(board);
  if (moves.length === 0) return null;

  const scratch = board.slice();
  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const move of moves) {
    scratch[move] = mark;
    const score = minimax(scratch, other(mark), mark, 1);
    scratch[move] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

/**
 * Easy opponent: a uniformly random legal move about half the time,
 * otherwise the same move as hard mode.
 * @param {readonly Cell[]} board
 * @param {Mark} mark
 * @param {() => number} [rng]
 * @returns {number | null}
 */
export function easyMove(board, mark, rng = Math.random) {
  const moves = legalMoves(board);
  if (moves.length === 0) return null;
  if (rng() < EASY_RANDOM_RATE) {
    const index = Math.min(moves.length - 1, Math.floor(rng() * moves.length));
    return moves[index];
  }
  return hardMove(board, mark);
}
