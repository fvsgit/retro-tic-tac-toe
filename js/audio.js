const STORAGE_KEY = 'neon-tac-muted';

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

function tone(frequency, when, duration, gainValue = 0.05) {
  if (!context || muted) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(gainValue, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + duration);
}

function blip(notes) {
  if (!context || muted) return;
  const now = context.currentTime;
  for (const note of notes) {
    tone(note.frequency, now + note.at, note.duration, note.gain ?? 0.05);
  }
}

export function playMove(mark) {
  blip([{ frequency: mark === 'X' ? 523 : 349, at: 0, duration: 0.07 }]);
}

export function playCursor() {
  blip([{ frequency: 740, at: 0, duration: 0.03, gain: 0.03 }]);
}

export function playUi() {
  blip([{ frequency: 880, at: 0, duration: 0.05, gain: 0.04 }]);
}

export function playWin() {
  blip([
    { frequency: 523, at: 0, duration: 0.08 },
    { frequency: 659, at: 0.09, duration: 0.08 },
    { frequency: 784, at: 0.18, duration: 0.08 },
    { frequency: 1046, at: 0.27, duration: 0.14 },
  ]);
}

export function playDraw() {
  blip([
    { frequency: 220, at: 0, duration: 0.12 },
    { frequency: 174, at: 0.13, duration: 0.18 },
  ]);
}
