import test from 'node:test';
import assert from 'node:assert/strict';
import {ACH, tier, tiers} from '../js/data/achievements.js';
import {S, fresh, regKey, replaceState, seenRegions} from '../js/state.js';

test('пороги достижений по возрастанию, id уникальны', () => {
  assert.equal(new Set(ACH.map(a => a.id)).size, ACH.length);
  for (const a of ACH) assert.deepEqual([...a.g].sort((x, y) => x - y), a.g, a.id);
});
test('tier считает пройденные ступени', () => {
  assert.equal(tier(0, [10, 100]), 0);
  assert.equal(tier(10, [10, 100]), 1);
  assert.equal(tier(1e9, [10, 100]), 2);
});
test('регионы из seen считаются по странам', () => {
  replaceState({...fresh(), seen: ['c0', 'tcivil', regKey('RU', '77'), regKey('RU', '16'), regKey('BY', '7')]});
  assert.equal(seenRegions(), 3);
  assert.equal(seenRegions('RU'), 2);
  assert.equal(seenRegions('BY'), 1);
  assert.equal(tiers().by, 1);
});
test('свежий игрок: ни одной ступени', () => {
  replaceState(fresh());
  assert.equal(Object.values(tiers()).reduce((s, x) => s + x, 0), 0);
});
