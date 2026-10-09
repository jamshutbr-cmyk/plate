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
  assert.ok(!/loadAll/.test(grab('autosell')) && /loadState/.test(grab('autosell')));
  assert.ok(!/loadAll/.test(rd('js/views/trade.js')));
});

test('частота опросов: обмены 10 с / 40 с, рынок 45 с, аукцион 15 с на экране и 45 с в фоне', () => {
  assert.ok(/setInterval\(tick,10000\)/.test(rd('js/views/trade.js')) && /TICK%4==0/.test(rd('js/views/trade.js')));
  assert.ok(/setInterval\(run,45000\)/.test(rd('js/views/market.js')));
  const a = rd('js/views/auction.js');
  assert.ok(/\+\+BG%3==0/.test(a) && /,15000\)/.test(a));
});
