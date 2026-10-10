const STORAGE_KEY = 'neon-tac-muted';

const RETRO = {
  id: 'retro',
  wave: 'square',
  shaped: false,
  move(mark) {
    return [{ frequency: mark === 'X' ? 523 : 349, at: 0, duration: 0.07, gain: 0.05 }];
  },
  cursor: [{ frequency: 740, at: 0, duration: 0.03, gain: 0.03 }],
  ui: [{ frequency: 880, at: 0, duration: 0.05, gain: 0.04 }],
  win: [
    { frequency: 523, at: 0, duration: 0.08, gain: 0.05 },
    { frequency: 659, at: 0.09, duration: 0.08, gain: 0.05 },
    { frequency: 784, at: 0.18, duration: 0.08, gain: 0.05 },
    { frequency: 1046, at: 0.27, duration: 0.14, gain: 0.05 },
  ],
  draw: [
    { frequency: 220, at: 0, duration: 0.12, gain: 0.05 },
    { frequency: 174, at: 0.13, duration: 0.18, gain: 0.05 },
  ],
};

const SCI_FI = {
  id: 'sci-fi',
  wave: 'sine',
  shaped: true,
  move(mark) {
    const frequency = mark === 'X' ? 494 : 370;
    return [
      { frequency, at: 0, duration: 0.16, gain: 0.028 },
      { frequency: frequency * 2, at: 0, duration: 0.12, gain: 0.012 },
    ];
  },
  cursor: [{ frequency: 880, at: 0, duration: 0.08, gain: 0.016 }],
  ui: [
    { frequency: 523, at: 0, duration: 0.1, gain: 0.022 },
    { frequency: 784, at: 0.06, duration: 0.14, gain: 0.016 },
  ],
  win: [
    { frequency: 392, at: 0, duration: 0.16, gain: 0.026 },
    { frequency: 494, at: 0.1, duration: 0.16, gain: 0.026 },
    { frequency: 587, at: 0.2, duration: 0.18, gain: 0.024 },
    { frequency: 784, at: 0.32, duration: 0.28, gain: 0.022 },
  ],
  draw: [
    { frequency: 196, at: 0, duration: 0.2, gain: 0.024 },
    { frequency: 147, at: 0.14, duration: 0.28, gain: 0.02 },
  ],
};

/** @param {string} theme */
export function soundPreset(theme) {
  return theme === 'sci-fi' ? SCI_FI : RETRO;
}

let active = RETRO;

/** @param {string} theme */
export function setSoundTheme(theme) {
  active = soundPreset(theme);
  return active.id;
}

export function currentSoundTheme() {
  return active.id;
}

let context = null;
let unlocked = false;

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();

export function isMuted() {
  return muted;
}

export function toggleMuted() {
  muted = !muted;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Private mode and blocked storage still toggle for this visit.
  }
  return muted;
}

/** Create the audio context on the first user gesture and never before. */
export function unlockAudio() {
  if (!unlocked) {
    unlocked = true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      context = new AudioCtx();
    } catch {
      context = null;
      return;
    }
  }
  if (context && context.state === 'suspended') {
    context.resume().catch(() => {});
  }
}

export function audioUnlocked() {
  return unlocked;
}

function tone(frequency, when, duration, gainValue, wave, shaped) {
  if (!context || muted) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, when);
  if (shaped) {
    const attack = Math.min(0.03, duration * 0.4);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  } else {
    gain.gain.setValueAtTime(gainValue, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  }
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + duration);
}

function blip(notes) {
  if (!context || muted) return;
  const now = context.currentTime;
  for (const note of notes) {
    tone(note.frequency, now + note.at, note.duration, note.gain ?? 0.05, active.wave, active.shaped);
  }
}

export function playMove(mark) {
  blip(active.move(mark));
}

export function playCursor() {
  blip(active.cursor);
}

export function playUi() {
  blip(active.ui);
}

export function playWin() {
  blip(active.win);
}

export function playDraw() {
  blip(active.draw);
}
