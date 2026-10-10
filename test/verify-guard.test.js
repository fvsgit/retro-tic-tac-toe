import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { CRITERIA } from '../tests/e2e/criteria.mjs';
import { assertDistinctCommits, assertPagesMatch, SITE_FILES } from '../tests/e2e/site.mjs';

const ZERO = '0000000000000000000000000000000000000000';
const HEAD = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BASE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

test('RETRO comparison refuses a commit compared with itself', () => {
  assert.throws(() => assertDistinctCommits(HEAD, HEAD), /itself/);
  assert.throws(() => assertDistinctCommits(HEAD, ZERO), /all zeros/);
  assert.throws(() => assertDistinctCommits('main', BASE), /full SHAs/);
  assert.doesNotThrow(() => assertDistinctCommits(HEAD, BASE));
});

test('the site build copies the same files as the Pages workflow', () => {
  const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  assertPagesMatch(workflow);
  assert.equal(SITE_FILES.includes('js/game.js'), true);
  assert.equal(SITE_FILES.includes('test/game.test.js'), false);
});

function section(doc, id) {
  const start = doc.indexOf(`## ${id}. `);
  assert.ok(start >= 0, `missing section ${id}`);
  const next = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, next === -1 ? undefined : next);
}

test('criteria.md numbers every acceptance criterion and marks the human ones', () => {
  const doc = fs.readFileSync('docs/criteria.md', 'utf8');
  for (const criterion of CRITERIA) {
    const body = section(doc, criterion.id);
    assert.match(body, criterion.human ? /Human: yes/ : /Human: no/);
  }
});
