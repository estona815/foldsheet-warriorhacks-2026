import test from 'node:test';
import assert from 'node:assert/strict';
import { planBooklet, fitPage } from '../src/imposition.mjs';

test('twelve-page golden print order', () => {
  const plan = planBooklet(12);
  assert.deepEqual(plan.sheets.map(s => [s.front, s.back]), [
    [[12, 1], [2, 11]], [[10, 3], [4, 9]], [[8, 5], [6, 7]],
  ]);
});

test('every supported count survives a fold reconstruction without loss', () => {
  for (let count = 1; count <= 64; count++) {
    const plan = planBooklet(count);
    const printed = plan.sheets.flatMap(s => [...s.front, ...s.back]);
    assert.deepEqual(printed.filter(p => p !== null).sort((a, b) => a - b),
      Array.from({ length: count }, (_, i) => i + 1));
    assert.equal(printed.filter(p => p === null).length, plan.blanks);
    // Reading a nested stack: right front/left back towards the center,
    // then right back/left front outwards. Independent of planner arithmetic.
    const reading = [
      ...plan.sheets.flatMap(s => [s.front[1], s.back[0]]),
      ...[...plan.sheets].reverse().flatMap(s => [s.back[1], s.front[0]]),
    ];
    assert.deepEqual(reading.slice(0, count),
      Array.from({ length: count }, (_, i) => i + 1));
    assert(reading.slice(count).every(p => p === null));
  }
});

test('invalid page counts fail instead of silently coercing', () => {
  for (const value of [0, 65, -1, 2.5, NaN, Infinity, '12', null, undefined]) {
    assert.throws(() => planBooklet(value), RangeError);
  }
});

test('fitting preserves aspect ratio and centers inside the margin', () => {
  for (const [width, height] of [[100, 200], [200, 100], [100, 100]]) {
    const fit = fitPage(width, height, 300, 400, 20);
    assert(Math.abs(fit.width / fit.height - width / height) < 1e-10);
    assert(fit.x >= 20 && fit.y >= 20);
    assert(fit.x + fit.width <= 280 && fit.y + fit.height <= 380);
  }
  assert.throws(() => fitPage(0, 100, 300, 400, 20), RangeError);
  assert.throws(() => fitPage(100, 100, 300, 400, 150), RangeError);
  assert.throws(() => fitPage(100, NaN, 300, 400, 20), RangeError);
});
