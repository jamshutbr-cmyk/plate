// Преобразование строк БД в кэш клиента (state.js): поля, значения по умолчанию, настройки.
import test from 'node:test';
import assert from 'node:assert/strict';
import {playerToState, plateFromRow, applyPlates, S} from '../js/state.js';

test('playerToState: поля игрока и настройки', () => {
  const s = playerToState({created_at: '2026-10-01T10:00:00Z', nick: 'Аня', balance: 12345, usd: 7, xp: 40, lvl: 3, cap_c: 150, cap_s: 10,
    daily_last: '2026-10-03T08:00:00Z', daily_streak: 2, rescue_last: null, country: 'BY', reg: 'Минск', seen: ['c0'],
    stats: {n: 5, best: 900, cls: [3, 2, 0, 0, 0], f: {0: 1}}, autosell: {lvl: 2, old: true},
    settings: {theme: 'gold', vol: 40, mute: true}});
  assert.equal(s.bal, 12345); assert.equal(s.capC, 150); assert.equal(s.country, 'BY'); assert.equal(s.theme, 'gold');
  assert.equal(s.vol, 40); assert.equal(s.mute, true); assert.equal(s.vib, true);   // не заданное берётся по умолчанию
  assert.equal(s.as.lvl, 2); assert.equal(s.as.t1, true);                            // автопродажа дополняется дефолтами
  assert.equal(s.rs, 0); assert.equal(s.dl, Date.parse('2026-10-03T08:00:00Z'));
});
test('plateFromRow и applyPlates: коллекция и сейф разделяются', () => {
  const row = (id, in_safe) => ({id, country: 'RU', type: 'civil', main: 'А777АА', reg: '77', region_name: 'Москва', cls: 4, mu: [1, 1, 1, 1], price: '2500', in_safe, created_at: '2026-10-03T10:00:00Z'});
  assert.equal(plateFromRow(row(1, false)).rn, 'Москва');
  assert.equal(plateFromRow(row(1, false)).price, 2500);
  applyPlates([row(1, false), row(2, true), row(3, false)]);
  assert.deepEqual(S.col.map((p) => p.id), [1, 3]);
  assert.deepEqual(S.safe.map((p) => p.id), [2]);
});
