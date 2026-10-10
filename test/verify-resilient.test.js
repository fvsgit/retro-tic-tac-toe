import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIsolatedRun, formatReport } from '../tests/e2e/criteria.mjs';

function collect() {
  const checks = new Map();
  const session = createIsolatedRun((id, ok, evidence) => {
    const list = checks.get(id) ?? [];
    list.push({ ok, evidence });
    checks.set(id, list);
  });
  return { checks, session };
}

test('a thrown criterion is FAIL with its message and the next criterion still runs', async () => {
  const { checks, session } = collect();
  const ran = [];
  await session.visit(4, async () => {
    ran.push('lines');
    await session.step(4, 'diagonal', async () => {
      assert.equal('X TURN', 'X WINS');
    });
    ran.push('after');
    await session.step(5, 'restart', async () => 'cleared');
  });
  const report = formatReport(checks, { head: 'abc', base: 'def' });
  assert.deepEqual(ran, ['lines', 'after']);
  assert.match(report.text, /04  FAIL {3}Every line wins and a full board draws/);
  assert.match(report.text, /05  PASS {3}No moves after the end until one restart/);
  assert.match(report.text, /restart cleared/);
  assert.ok(report.fail > 0);
});

test('a throw outside a check is FAIL for that visit and the next visit still runs', async () => {
  const { checks, session } = collect();
  const ran = [];
  await session.visit(4, async () => {
    ran.push(4);
    throw new Error('diagonal missed');
  });
  await session.visit(5, async () => {
    ran.push(5);
    await session.step(5, 'restart', async () => 'cleared');
  });
  const report = formatReport(checks, { head: 'abc', base: 'def' });
  assert.deepEqual(ran, [4, 5]);
  assert.match(report.text, /04  FAIL {3}Every line wins and a full board draws/);
  assert.match(report.text, /diagonal missed/);
  assert.match(report.text, /05  PASS {3}No moves after the end until one restart/);
  assert.equal(report.fail > 0, true);
});
