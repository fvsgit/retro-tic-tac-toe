import assert from 'node:assert/strict';
import { test } from 'node:test';
import { easyMove, hardMove } from '../js/game.js';
import { EASY_SEED, checkFixtures, withSeed } from '../tests/e2e/sim.mjs';

test('easy mode is beatable when Math.random is stubbed with seed 2', () => {
  checkFixtures();
});

test('easyMove reads the stubbed Math.random and does not need a game hook', () => {
  const move = withSeed(EASY_SEED, () => easyMove(
    ['X', null, null, null, null, null, null, null, null],
    'O',
  ));
  assert.equal(typeof move, 'number');
  assert.ok(move >= 0 && move <= 8);
  assert.equal(Math.random.name, 'random');
});

test('hardMove does not call Math.random', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random called');
  };
  try {
    const move = hardMove(['X', null, null, null, null, null, null, null, null], 'O');
    assert.equal(move, 4);
  } finally {
    Math.random = original;
  }
});
