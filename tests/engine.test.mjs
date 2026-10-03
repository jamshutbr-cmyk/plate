// Тесты правил игры. Правила живут на сервере: supabase/functions/_shared/engine.ts. Запуск: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, mk} from '../supabase/functions/_shared/engine.ts';
import {RR, BR, RICH} from '../js/data/regions.js';

const mkRegs = (t, c) => Object.keys(t).map((code) => ({code, name: t[code][0], mult: t[code][1], rich: c != 'RU' || RICH.has(code)}));
const REG = {RU: mkRegs(RR, 'RU'), BY: mkRegs(BR, 'BY')};

test('classify: без повторов = обычный', () => {
  assert.equal(classify('139', 'АВС').cls, 0);
});
test('classify: три одинаковые цифры и пара букв = эпический или выше', () => {
  assert.ok(classify('777', 'ААВ').cls >= 3);
});
test('classify: всё одинаковое = легендарный', () => {
  assert.equal(classify('777', 'ААА').cls, 4);
});
test('mk: номер валидный, цена положительная', () => {
  for (let i = 0; i < 500; i++) {
    const c = i % 2 ? 'RU' : 'BY';
    const p = mk({country: c, reg: ''}, REG[c]);
    assert.ok(p.price > 0);
    assert.ok(p.cls >= 0 && p.cls <= 4);
    assert.ok(['civil', 'taxi', 'police'].includes(p.type));
  }
});
test('распределение редкостей: обычных и необычных большинство', () => {
  const n = 5000, c = [0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) c[mk({country: 'RU', reg: ''}, REG.RU).cls]++;
  assert.ok((c[0] + c[1]) / n > 0.8);
});
