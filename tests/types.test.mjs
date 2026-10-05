// Типы номеров: шансы, формат, цены, Беларусь, зеркало config.js ↔ engine.ts ↔ SQL, баланс.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import * as srv from '../supabase/functions/_shared/engine.ts';
import {FL, RAR, SAMP, TYPES, NOREG} from '../js/config.js';
import {feats as cliFeats} from '../js/engine.js';
import {S} from '../js/state.js';
import {ACH} from '../js/data/achievements.js';
import {exactMean, seedRegions} from './balance-lib.mjs';

const REG = seedRegions();
const KEYS = ['civil', 'taxi', 'police', 'transit', 'military', 'diplomat', 'retro'];
const BY_KEYS = ['civil', 'taxi', 'police', 'transit'];
const FORMAT = {   // регулярка main у каждого типа в России
  civil: /^[А-Я]\d{3}[А-Я]{2}$/, police: /^[А-Я]\d{3}[А-Я]{2}$/, transit: /^[А-Я]\d{3}[А-Я]{2}$/,
  taxi: /^[А-Я]{2} \d{3}$/, military: /^\d{4} [А-Я]{2}$/, diplomat: /^\d{3} CD \d{2}$/, retro: /^\d{2}-\d{2} [А-Я]{3}$/,
};
const BY_FORMAT = /^\d{4} [A-Z]{2}-$/;

// Принудительно выпадает один тип: остальным шанс 0 (TYPES — обычный массив, mk читает его при каждом вызове)
function only(k, fn) {
  const save = srv.TYPES.map((t) => t.p);
  srv.TYPES.forEach((t) => { t.p = t.k == k ? 1 : 0; });
  try { return fn(); } finally { srv.TYPES.forEach((t, i) => { t.p = save[i]; }); }
}

test('сумма шансов всех типов равна 100 (клиент и сервер)', () => {
  for (const T of [srv.TYPES, TYPES]) assert.equal(Math.round(T.reduce((a, t) => a + t.p, 0) * 1e6) / 1e6, 100);
  assert.deepEqual(srv.TYPES.map((t) => t.k), KEYS);
});

test('клиентский и серверный TYPES совпадают (k, p, m, страны)', () => {
  const strip = (T) => T.map(({k, p, m, c}) => ({k, p, m, c}));
  assert.deepEqual(strip(TYPES), strip(srv.TYPES));
  for (const t of TYPES) assert.ok(t.n && typeof t.n == 'string', 'у типа есть название: ' + t.k);
});

test('формат main у каждого типа в России', () => {
  for (const k of KEYS) only(k, () => {
    for (let i = 0; i < 300; i++) {
      const p = srv.mk({country: 'RU', reg: ''}, REG.RU);
      assert.equal(p.type, k);
      assert.match(p.main, FORMAT[k], k);
      assert.ok(p.price > 0 && p.cls >= 0 && p.cls <= 4);
      assert.ok(Number.isSafeInteger(p.price));
    }
  });
});

test('Беларусь: только civil, taxi, police, transit, у всех формат «1234 AB-»', () => {
  assert.deepEqual(TYPES.filter((t) => t.c.includes('BY')).map((t) => t.k), BY_KEYS);
  const save = srv.TYPES.map((t) => t.p);
  srv.TYPES.forEach((t) => { t.p = 20; });   // даже при огромном шансе русские типы в Беларуси не выпадают
  try {
    const seen = new Set();
    for (let i = 0; i < 4000; i++) {
      const p = srv.mk({country: 'BY', reg: ''}, REG.BY);
      seen.add(p.type); assert.match(p.main, BY_FORMAT);
    }
    assert.deepEqual([...seen].sort(), [...BY_KEYS].sort());
  } finally { srv.TYPES.forEach((t, i) => { t.p = save[i]; }); }
});

test('цена не выходит за 2^53 даже в худшем случае', () => {
  const maxMult = Math.max(...REG.RU.map((r) => r.mult)) * srv.RU_AVG / (REG.RU.reduce((a, r) => a + r.mult * (r.rich ? 3 : 1), 0) / REG.RU.reduce((a, r) => a + (r.rich ? 3 : 1), 0));
  const worst = 100 * srv.RAR_M[4] * 1.6 * maxMult * Math.max(...srv.TYPES.map((t) => t.m));
  assert.ok(worst < 2 ** 53, 'worst ' + worst);
  assert.ok(worst < 1e12, 'порядок цены остаётся разумным: ' + worst);
});

test('отрисовка: типы без блока региона — только новые русские', () => {
  assert.deepEqual(NOREG, ['military', 'diplomat', 'retro']);
  for (const k of NOREG) assert.ok(!TYPES.find((t) => t.k == k).c.includes('BY'));
});

test('признаки: названия FL и индексы feats совпадают с типами', () => {
  assert.deepEqual(FL.slice(8), TYPES.map((t) => t.n));
  KEYS.forEach((k, i) => {
    assert.deepEqual(srv.feats({main: 'А123ВС', reg: '77', type: k}).slice(-1), [8 + i]);
    assert.deepEqual(cliFeats({main: 'А123ВС', reg: '77', type: k}).slice(-1), [8 + i]);
  });
});

test('достижения: по одному на каждый новый тип', () => {
  const save = S.stats; S.stats = {n: 0, best: 0, cls: [0, 0, 0, 0, 0], f: {11: 2, 12: 3, 13: 4, 14: 5}};
  try {
    for (const [id, n] of [['trn', 2], ['mil', 3], ['dip', 4], ['ret', 5]]) assert.equal(ACH.find((a) => a.id == id).v(), n, id);
  } finally { S.stats = save; }
});

test('образцы каталога новых типов: редкость образца совпадает с его номером в списке', () => {
  const parse = (k, main) => k == 'diplomat' ? [main.slice(0, 3), main.slice(-2)] : [main.replace(/\D/g, ''), main.replace(/[\d\s-]/g, '')];
  for (const k of ['military', 'diplomat', 'retro']) SAMP.RU[k].forEach((main, i) => {
    const [d, ls] = parse(k, main);
    assert.equal(srv.classify(d, ls).cls, i, k + ' ' + main);
  });
  assert.equal(RAR.length, 5);
});

test('SQL: check по type содержит все типы из config.js, функции типов не перечисляют', () => {
  const dir = new URL('../supabase/', import.meta.url);
  const want = KEYS.slice().sort();
  const list = (s) => [...s.matchAll(/type\s+in\s*\(([^)]*)\)/g)].map((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort());
  for (const f of ['schema.sql', 'market.sql', 'types_v2.sql']) {
    const l = list(readFileSync(new URL(f, dir), 'utf8'));
    assert.ok(l.length > 0, f);
    for (const x of l) assert.deepEqual(x, want, f);
  }
  const t2 = readFileSync(new URL('types_v2.sql', dir), 'utf8');
  assert.match(t2, /drop constraint if exists/i); assert.match(t2, /add constraint/i);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const rest = readFileSync(new URL(f, dir), 'utf8').replace(/type\s+in\s*\([^)]*\)/g, '').replace(/^\s*--.*$/gm, '');
    assert.doesNotMatch(rest, /'(taxi|police|transit|military|diplomat|retro)'/, f + ': тип прописан не в check');
  }
  // спецномер для автопродажи = всё, что не civil (поэтому transit подчиняется флагу sp)
  assert.match(readFileSync(new URL('prestige.sql', dir), 'utf8'), /type = 'civil' or \(l >= 5 and sp\)/);
});

test('баланс: средняя цена номера выросла не больше чем на 10%', () => {
  // Точное ожидание (перебором, без шума) при прежних трёх типах 95/4/1: Россия 47 786 ₽, Беларусь 46 909 ₽
  const before = {RU: 47786, BY: 46909};
  for (const c of ['RU', 'BY']) {
    const now = exactMean(srv, REG, c);
    assert.ok(now <= before[c] * 1.10, `${c}: ${Math.round(now)} против ${before[c]}`);
    assert.ok(now >= before[c] * 0.9, `${c}: ${Math.round(now)} слишком упала`);
  }
});
