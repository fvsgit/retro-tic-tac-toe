/** localStorage key. The boot script in index.html reads the same key. */
export const THEME_STORAGE_KEY = 'neon-tac-theme';

/** @param {string | null | undefined} value */
export function normalizeTheme(value) {
  return value === 'sci-fi' ? 'sci-fi' : 'retro';
}

/**
 * @param {{ getItem: (key: string) => string | null }} storage
 * @returns {'retro' | 'sci-fi'}
 */
export function readTheme(storage) {
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'retro';
  }
}

/**
 * @param {{ setItem: (key: string, value: string) => void }} storage
 * @param {string} theme
 * @returns {'retro' | 'sci-fi'}
 */
export function writeTheme(storage, theme) {
  const next = normalizeTheme(theme);
  try {
    storage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private mode and blocked storage still apply for this visit.
  }
  return next;
}

/** @param {string} theme */
export function toggleThemeName(theme) {
  return theme === 'sci-fi' ? 'retro' : 'sci-fi';
}

/** Easy and hard are difficulties. Two players has none. */
export function difficultyOf(mode) {
  if (mode === 'easy' || mode === 'hard') return mode;
  return null;
}

/**
 * Theme is the only field that changes. Board, turn, mode, difficulty,
 * mute, score, and the win or draw result stay on the same values.
 * @param {object} snapshot
 * @param {string} theme
 */
export function applyTheme(snapshot, theme) {
  return {
    theme: normalizeTheme(theme),
    board: snapshot.board,
    turn: snapshot.turn,
    mode: snapshot.mode,
    difficulty: snapshot.difficulty,
    muted: snapshot.muted,
    score: snapshot.score,
    winner: snapshot.winner,
    line: snapshot.line,
    draw: snapshot.draw,
    game: snapshot.game,
  };
}
