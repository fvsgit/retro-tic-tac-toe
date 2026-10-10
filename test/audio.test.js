import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentSoundTheme, isMuted, setSoundTheme, soundPreset } from '../js/audio.js';

test('each theme has its own preset and retro keeps the 8-bit sounds', () => {
  const retro = soundPreset('retro');
  assert.equal(retro.id, 'retro');
  assert.equal(retro.wave, 'square');
  assert.equal(retro.shaped, false);
  assert.deepEqual(retro.move('X'), [{ frequency: 523, at: 0, duration: 0.07, gain: 0.05 }]);
  assert.deepEqual(retro.move('O'), [{ frequency: 349, at: 0, duration: 0.07, gain: 0.05 }]);
  assert.deepEqual(retro.cursor, [{ frequency: 740, at: 0, duration: 0.03, gain: 0.03 }]);
  assert.deepEqual(retro.ui, [{ frequency: 880, at: 0, duration: 0.05, gain: 0.04 }]);
  assert.deepEqual(retro.win, [
    { frequency: 523, at: 0, duration: 0.08, gain: 0.05 },
    { frequency: 659, at: 0.09, duration: 0.08, gain: 0.05 },
    { frequency: 784, at: 0.18, duration: 0.08, gain: 0.05 },
    { frequency: 1046, at: 0.27, duration: 0.14, gain: 0.05 },
  ]);
  assert.deepEqual(retro.draw, [
    { frequency: 220, at: 0, duration: 0.12, gain: 0.05 },
    { frequency: 174, at: 0.13, duration: 0.18, gain: 0.05 },
  ]);

  const sciFi = soundPreset('sci-fi');
  assert.equal(sciFi.id, 'sci-fi');
  assert.equal(sciFi.wave, 'sine');
  assert.equal(sciFi.shaped, true);
  assert.notDeepEqual(sciFi.move('X'), retro.move('X'));
  assert.notDeepEqual(sciFi.win, retro.win);
  for (const note of [...sciFi.move('X'), ...sciFi.move('O'), ...sciFi.ui, ...sciFi.win, ...sciFi.draw]) {
    assert.ok(note.gain < 0.05, 'sci-fi tones stay softer than the retro blips');
    assert.ok(note.duration >= 0.08);
  }

  assert.equal(soundPreset('nope').id, 'retro');
  assert.equal(isMuted(), false);
  assert.equal(setSoundTheme('sci-fi'), 'sci-fi');
  assert.equal(currentSoundTheme(), 'sci-fi');
  assert.equal(isMuted(), false);
  setSoundTheme('retro');
  assert.equal(currentSoundTheme(), 'retro');
  assert.equal(isMuted(), false);
});
