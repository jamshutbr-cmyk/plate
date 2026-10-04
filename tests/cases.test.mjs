// Кейсы: сверка config.js / cars.js с supabase/cases.sql, шансы и экономика (без бесконечных денег).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {CASES, CAR_CLS, CAR_VAL, DUP_PCT, RAR, START, START_CAR, dupRefund} from '../js/config.js';
import {CARS, caseOdds, carsOfClass} from '../js/data/cars.js';
import {fresh, playerToState} from '../js/state.js';

const sql = readFileSync(new URL('../supabase/cases.sql', import.meta.url), 'utf8');
// Строки values (...) из нужного insert-а
const rows = (table) => {
  const m = sql.match(new RegExp(`insert into public\\.${table}[^;]*?values([\\s\\S]*?)on conflict`));
  assert.ok(m, `нет insert в ${table}`);
  return [...m[1].matchAll(/\(([^()]*)\)/g)].map((r) => r[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')));
};
const sum = (a) => a.reduce((s, x) => s + x, 0);

test('кейсы: CASES в config.js совпадают с case_defs в cases.sql', () => {
  const srv = rows('case_defs').map((r) => [r[0], +r[1], ...r.slice(2).map(Number)]);
  const cfg = CASES.map((c) => [c.id, c.p, ...c.w]);
  assert.ok(srv.length > 0);
  assert.deepEqual(srv.sort(), cfg.sort());
  // список кейсов, которые сервер оставляет (остальные удаляются)
  const keep = [...sql.match(/id <> all \(array\[([^\]]*)\]/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(keep.sort(), CASES.map((c) => c.id).sort());
});
test('кейсы: у каждого кейса веса дают ровно 100%, цена положительная, id уникальны', () => {
  assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length);
  for (const c of CASES) {
    assert.equal(c.w.length, RAR.length, c.id);
    assert.ok(c.w.every((x) => x >= 0), c.id);
    assert.ok(Math.abs(sum(c.w) - 100) < 1e-9, `${c.id}: ${sum(c.w)}`);
    assert.ok(c.p > 0, c.id);
  }
});
test('машины: id и классы в cars.js совпадают с car_defs в cases.sql', () => {
  const srv = rows('car_defs').map((r) => [r[0], +r[1]]);
  const cfg = CARS.map((c) => [c.id, c.r]);
  assert.deepEqual(srv.sort(), cfg.sort());
});
test('машины: у каждой есть класс 0..4, картинка и данные для номера, id уникальны', () => {
  assert.equal(new Set(CARS.map((c) => c.id)).size, CARS.length);
  for (const c of CARS) {
    assert.ok(Number.isInteger(c.r) && c.r >= 0 && c.r < RAR.length, c.id);
    assert.ok(existsSync(new URL('../' + c.img, import.meta.url)), `нет картинки ${c.img}`);
    for (const k of ['ar', 'x', 'y', 'w']) assert.ok(c[k] > 0, `${c.id}.${k}`);
  }
});
test('классы: названия, стоимость и доля возврата совпадают с cases.sql', () => {
  assert.equal(CAR_CLS.length, RAR.length);
  assert.equal(CAR_VAL.length, RAR.length);
  const srv = rows('car_classes').map((r) => [+r[0], +r[1]]);
  assert.deepEqual(srv, CAR_VAL.map((v, r) => [r, v]));
  assert.equal(+sql.match(/dup_pct constant int := (\d+)/)[1], DUP_PCT);
  assert.ok(DUP_PCT > 0 && DUP_PCT < 100);
  CAR_VAL.forEach((v, r) => assert.equal(dupRefund(r), Math.floor((v * DUP_PCT) / 100)));
  assert.ok(CAR_VAL.every((v, r) => r == 0 || v > CAR_VAL[r - 1]), 'стоимость классов растёт');
});
test('стартовая машина: есть в cars.js, в car_defs, в default колонки и в reset_progress', () => {
  assert.ok(CARS.some((c) => c.id == START_CAR));
  assert.ok(sql.includes(`default '{${START_CAR}}'`));
  assert.ok(sql.includes(`cars = array['${START_CAR}']`));
  assert.ok(sql.includes(`array_prepend('${START_CAR}', cars)`));   // существующим игрокам стартовая машина добавляется
  assert.deepEqual(fresh().cars, [START_CAR]);
  assert.deepEqual(playerToState({balance: 1, cars: ['niva', 'zhiguli']}).cars, ['niva', 'zhiguli']);
  assert.deepEqual(playerToState({balance: 1}).cars, [START_CAR]);   // старая строка без cars
  assert.deepEqual(playerToState({balance: 1, cars: []}).cars, [START_CAR]);
});
test('честные шансы: сумма 100%, класс без машин получает 0, остальные делят его долю', () => {
  for (const c of CASES) {
    const od = caseOdds(c.w);
    assert.ok(Math.abs(sum(od) - 100) < 1e-9, c.id);
    od.forEach((x, r) => { if (!carsOfClass(r).length) assert.equal(x, 0, `${c.id} класс ${r}`); });
  }
  // легендарных машин пока нет: у «Легендарного» шанс эпика растёт с 55% до 55/75
  const leg = caseOdds(CASES.find((c) => c.id == 'legend').w);
  if (!carsOfClass(4).length) assert.ok(Math.abs(leg[3] - (55 * 100) / 75) < 1e-9);
  assert.deepEqual(caseOdds([0, 0, 0, 0, 100]).map(Number), [0, 0, 0, 0, carsOfClass(4).length ? 100 : 0]);   // кейс только из пустого класса не ломает показ
});
test('экономика: даже если все выпавшие машины дубликаты, возврат в среднем меньше цены кейса', () => {
  for (const c of CASES) {
    const worstAll = sum(c.w.map((w, r) => (w / 100) * dupRefund(r)));       // по всем классам таблицы
    const od = caseOdds(c.w);
    const worstReal = sum(od.map((p, r) => (p / 100) * dupRefund(r)));      // по классам, где реально есть машины
    assert.ok(worstAll < c.p * 0.95, `${c.id}: возврат ${worstAll} против цены ${c.p}`);
    assert.ok(worstReal < c.p * 0.95, `${c.id}: возврат ${worstReal} против цены ${c.p}`);
  }
});
test('экономика: цены кейсов растут, шансы дорогих классов растут вместе с ценой', () => {
  for (let i = 1; i < CASES.length; i++) assert.ok(CASES[i].p > CASES[i - 1].p);
  const top = (c) => c.w[3] + c.w[4];
  for (let i = 1; i < CASES.length; i++) assert.ok(top(CASES[i]) >= top(CASES[i - 1]), CASES[i].id);
  assert.ok(CASES[0].p >= START / 2);   // самый дешёвый кейс не раздаётся даром на старте
});
test('права: open_case закрыт от anon и открыт только authenticated, таблицы только на чтение', () => {
  assert.match(sql, /revoke execute on function public\.open_case\(text\) from public, anon/);
  assert.match(sql, /grant\s+execute on function public\.open_case\(text\) to authenticated/);
  assert.match(sql, /open_case[\s\S]*security definer set search_path = public/);
  assert.match(sql, /for update/);
  assert.match(sql, /revoke insert, update, delete on public\.car_classes, public\.car_defs, public\.case_defs from anon, authenticated/);
});
