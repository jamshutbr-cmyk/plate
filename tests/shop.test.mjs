// Магазин: платный регион и каталог. Сверяет серверные правила (_shared/engine.ts)
// с клиентскими копиями (js/config.js) и с shop.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as srv from '../supabase/functions/_shared/engine.ts';
import {REGION_FEE_BASE, SHOP, regFee} from '../js/config.js';
import {RR, BR, RICH, regList} from '../js/data/regions.js';

const mkRegs = (t, c) => Object.keys(t).map((code) => ({code, name: t[code][0], mult: t[code][1], rich: c != 'RU' || RICH.has(code)}));
const REG = {RU: mkRegs(RR, 'RU'), BY: mkRegs(BR, 'BY')};

test('доплата за регион: клиент и сервер считают одинаково для каждого региона', () => {
  assert.equal(srv.REGION_FEE_BASE, REGION_FEE_BASE);
  for (const c of ['RU', 'BY'])
    for (const r of regList(c)) assert.equal(regFee(r.m), srv.regionFee(REG[c], r.n), `${c} ${r.n}`);
});
test('доплата за регион: без региона 0, престижнее значит дороже', () => {
  assert.equal(srv.regionFee(REG.RU, ''), 0);
  assert.equal(srv.regionFee(REG.RU, 'Нет такого региона'), 0);
  const f = (n) => srv.regionFee(REG.RU, n);
  assert.ok(f('Москва') > f('Санкт-Петербург') && f('Санкт-Петербург') > f('Татарстан') && f('Татарстан') > f('Рязанская область'));
  assert.equal(f('Рязанская область'), REGION_FEE_BASE);
});

test('каталог магазина в config.js совпадает с shop.sql', () => {
  const sql = readFileSync(new URL('../supabase/shop.sql', import.meta.url), 'utf8');
  const rows = [...sql.matchAll(/\(\s*'(\w+)',\s*'(skin|title|drop|nick|bg|show)',\s*(\d+)\s*\)/g)].map((m) => [m[1], m[2], +m[3]]);
  const cfg = Object.entries(SHOP).flatMap(([slot, a]) => a.map((it) => [it.id, slot, it.p]));
  assert.ok(rows.length > 0);
  assert.deepEqual(rows.sort(), cfg.sort());
});
