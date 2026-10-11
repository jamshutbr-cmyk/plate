// Лаборатория тестировщиков: клиентские константы должны совпадать с supabase/testers.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAB, itemOf} from '../js/config.js';

const sql = readFileSync(new URL('../supabase/testers.sql', import.meta.url), 'utf8');
test('ранги: пороги в SQL = LAB.ranks', () => {
  const m = [...sql.matchAll(/when n >= (\d+) then (\d)/g)].map((x) => [+x[1], +x[2]]);
  assert.equal(m.length, LAB.ranks.length);
  for (const [at, r] of m) assert.equal(LAB.ranks[r - 1].at, at);
});
test('бонусы за ранг: SQL = LAB.bonus', () => {
  const arr = (n) => sql.match(new RegExp(n + ' constant \\w+\\[\\] := array\\[([^\\]]+)\\]'))[1].split(',').map(Number);
  const rb = arr('rb'), ub = arr('ub');
  LAB.bonus.forEach((b, i) => { assert.equal(rb[i], b.rub); assert.equal(ub[i], b.usd); });
});
test('титулы и рамка: есть в shop_items (для equip_item) и распознаются клиентом', () => {
  for (const id of [...LAB.titles.map((t) => t.id), LAB.skin.id]) { assert.ok(sql.includes(`('${id}',`), id); assert.ok(itemOf(id), id); }
  for (const t of LAB.titles) assert.ok(itemOf(t.id).c);
  assert.equal(sql.match(/array\['tester', 'bh2', 'bh3', 'bh4'\]/g).length >= 2, true);
});
test('категории бага: SQL = клиент', () => {
  const cats = sql.match(/cat\s+text not null check \(cat in \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(cats, LAB.cats.map((c) => c[0]));
});
