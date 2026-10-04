// Магазин: платный регион, свой номер и каталог. Сверяет серверные правила (_shared/engine.ts)
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

test('свой номер: формат, нормализация латиницы, ошибки', () => {
  const ok = srv.customPlate('RU', 'АВС', '013', '77', REG.RU);
  assert.equal(ok.plate.main, 'А013ВС');
  assert.equal(ok.plate.type, 'civil');
  assert.equal(ok.plate.reg, '77');
  assert.equal(srv.customPlate('RU', 'abc', '013', '77', REG.RU).plate.main, 'А013ВС');   // латиница → кириллица
  assert.equal(srv.customPlate('BY', 'ab', '1234', '7', REG.BY).plate.main, '1234 AB-');
  const bad = (...a) => srv.customPlate(...a).error;
  assert.equal(bad('RU', 'ЖАВ', '013', '77', REG.RU), 'bad letters');
  assert.equal(bad('RU', 'АВ', '013', '77', REG.RU), 'bad letters');
  assert.equal(bad('RU', 'АВС', '000', '77', REG.RU), 'bad digits');
  assert.equal(bad('RU', 'АВС', '12', '77', REG.RU), 'bad digits');
  assert.equal(bad('RU', 'АВС', '12a', '77', REG.RU), 'bad digits');
  assert.equal(bad('RU', 'АВС', '013', '999', REG.RU), 'bad region');
  assert.equal(bad('XX', 'АВС', '013', '77', REG.RU), 'bad country');
});
test('свой номер: цена растёт с красотой номера и престижем региона', () => {
  const cost = (l, d, r) => srv.customPlate('RU', l, d, r, REG.RU).cost;
  assert.equal(cost('АВС', '013', '62'), srv.CUSTOM_BASE);                       // обычный номер в простом регионе: минимум
  assert.ok(cost('АВС', '013', '77') > cost('АВС', '013', '62'));               // престижный регион дороже
  assert.ok(cost('АСА', '777', '77') >= 50e6);                                   // красивый номер в Москве от 50 млн
  assert.ok(cost('АСА', '777', '77') > cost('АВА', '121', '77') && cost('АВА', '121', '77') > cost('АВС', '013', '77'));
  assert.ok(cost('ААА', '777', '777') > cost('АСА', '777', '777'));
});
test('свой номер: купить и продать за 50% невыгодно ни при каких комбинациях', () => {
  const L = 'АВЕКМНОРСТУХ';
  for (const c of ['RU', 'BY'])
    for (let i = 0; i < 3000; i++) {
      const nd = c == 'RU' ? 3 : 4, nl = c == 'RU' ? 3 : 2;
      const d = Array.from({length: nd}, () => srv.rnd(10)).join(''), l = Array.from({length: nl}, () => (c == 'RU' ? L : 'ABEIKMHOPCTX')[srv.rnd(12)]).join('');
      const reg = REG[c][srv.rnd(REG[c].length)].code, r = srv.customPlate(c, l, d, reg, REG[c]);
      if (r.error) { assert.equal(r.error, 'bad digits'); continue; }   // «000» отклоняется
      assert.ok(r.cost >= 2 * r.plate.price, `${c} ${r.plate.main} ${reg}: cost ${r.cost}, price ${r.plate.price}`);
    }
});

test('каталог магазина в config.js совпадает с shop.sql', () => {
  const sql = readFileSync(new URL('../supabase/shop.sql', import.meta.url), 'utf8');
  const rows = [...sql.matchAll(/\(\s*'(\w+)',\s*'(skin|title|drop)',\s*(\d+)\s*\)/g)].map((m) => [m[1], m[2], +m[3]]);
  const cfg = Object.entries(SHOP).flatMap(([slot, a]) => a.map((it) => [it.id, slot, it.p]));
  assert.ok(rows.length > 0);
  assert.deepEqual(rows.sort(), cfg.sort());
});
