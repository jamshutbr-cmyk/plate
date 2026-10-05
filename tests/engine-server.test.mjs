// Сверка серверного движка с клиентскими копиями: feats (клиент считает им статистику «за сессию»),
// формат номеров и множитель региона.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as srv from '../supabase/functions/_shared/engine.ts';
import {feats as cliFeats} from '../js/engine.js';
import {RR, BR, RICH} from '../js/data/regions.js';

const mkRegs = (t, c) => Object.keys(t).map((code) => ({code, name: t[code][0], mult: t[code][1], rich: c != 'RU' || RICH.has(code)}));
const REG = {RU: mkRegs(RR, 'RU'), BY: mkRegs(BR, 'BY')};

test('feats на клиенте совпадает с сервером', () => {
  for (const main of ['А777АА', 'К001АВ', 'X123КМ', '7777 AA-', 'КК 111', 'А100АА', '1357 АВ', '777 CD 44', '11-11 МММ'])
    for (const type of ['civil', 'taxi', 'police', 'transit', 'military', 'diplomat', 'retro'])
      for (const reg of ['77', '1', '777', '10'])
        assert.deepEqual(cliFeats({main, reg, type}), srv.feats({main, reg, type}));
});
test('mk: формат и средний множитель региона', () => {
  for (const c of ['RU', 'BY']) {
    let sum = 0, n = 4000;
    for (let i = 0; i < n; i++) {
      const p = srv.mk({country: c, reg: ''}, REG[c]);
      assert.match(p.main, c == 'RU'
        ? /^([А-Я]\d{3}[А-Я]{2}|[А-Я]{2} \d{3}|\d{4} [А-Я]{2}|\d{3} CD \d{2}|\d{2}-\d{2} [А-Я]{3})$/
        : /^\d{4} [A-Z]{2}-$/);
      sum += p.mu[2];
    }
    const avg = sum / n, want = c == 'RU' ? srv.RU_AVG : REG.BY.reduce((a, r) => a + r.mult * 3, 0) / (REG.BY.length * 3);
    assert.ok(Math.abs(avg - want) / want < 0.08, `${c}: avg ${avg} vs ${want}`);
  }
});
test('mk: выбранный регион фиксирует регион и множитель', () => {
  const p = srv.mk({country: 'RU', reg: 'Татарстан'}, REG.RU);
  assert.equal(p.rn, 'Татарстан');
  assert.ok(Math.abs(p.mu[2] - srv.RU_AVG) < 1e-9);
});
