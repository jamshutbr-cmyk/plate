// Трафик: колонки номеров совпадают со схемой, частые действия не качают лишнее, опросы не чаще нужного.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('plates: выбираем только существующие колонки, нужные клиенту', () => {
  const cols = rd('js/server.js').match(/PLATE_COLS='([^']+)'/)[1].split(',');
  const tbl = rd('supabase/schema.sql').match(/create table public\.plates \(([\s\S]*?)\n\);/)[1];
  for (const c of cols) assert.ok(new RegExp(`^\\s*${c}\\s`, 'm').test(tbl), `нет колонки ${c} в plates`);
  assert.ok(!cols.includes('owner'), 'owner клиенту не нужен');
  for (const c of ['id', 'cls', 'main', 'mu', 'price', 'in_safe', 'region_name']) assert.ok(cols.includes(c), c);
});

test('ставка, автопродажа, рынок и обмен не перекачивают пасс и окно продажи (loadAll)', () => {
  const api = rd('js/api.js');
  const grab = (name) => { const i = api.indexOf(` async ${name}(`); return api.slice(i, api.indexOf('\n async ', i + 5)); };
  assert.ok(!/loadAll/.test(grab('auctionBid')) && /loadPlayer/.test(grab('auctionBid')), 'ставка меняет только баланс');
  assert.ok(!/loadAll/.test(grab('marketBuy')) && /loadState/.test(grab('marketBuy')));
  assert.ok(!/loadAll|loadState|loadPlates/.test(grab('autosell')), 'автопродажа правит кэш по ответу сервера, список не перезагружает');
  assert.ok(!/loadAll/.test(rd('js/views/trade.js')));
});

test('частота опросов: обмены 30 с / 3 мин, рынок 3 мин, аукцион 30 с на экране и 3 мин в фоне', () => {
  assert.ok(/setInterval\(tick,30000\)/.test(rd('js/views/trade.js')) && /TICK%6==0/.test(rd('js/views/trade.js')));
  assert.ok(/setInterval\(run,180000\)/.test(rd('js/views/market.js')));
  const a = rd('js/views/auction.js');
  assert.ok(/\+\+BG%6==0/.test(a) && /,30000\)/.test(a));
});

test('таймер аукциона не трогает чужие таймеры: свой атрибут data-aend, банк остаётся на data-end', () => {
  const a = rd('js/views/auction.js'), b = rd('js/views/bank.js');
  assert.ok(!/data-end/.test(a) && !/\[data-end\]/.test(a), 'аукцион не должен обновлять [data-end] (так ломались вклады в банке)');
  assert.ok(/querySelectorAll\('\[data-aend\]'\)/.test(a));
  assert.ok(/data-end/.test(b) && !/data-aend/.test(b));
});
