// Рынок игроков: сверка констант config.js с supabase/market.sql, комиссия и разбор цены, права на функции.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MARKET, marketFee} from '../js/config.js';
import {parseAsk} from '../js/util.js';

const sql = readFileSync(new URL('../supabase/market.sql', import.meta.url), 'utf8');
const num = (name) => {
  const m = sql.match(new RegExp(`${name}\\s+constant\\s+\\w+\\s*:=\\s*(\\d+)`));
  assert.ok(m, `нет константы ${name} в market.sql`);
  return Number(m[1]);
};

test('константы рынка: config.js и market.sql совпадают', () => {
  assert.equal(num('fee_pct'), MARKET.fee);
  assert.equal(num('min_ask'), MARKET.min);
  assert.equal(num('max_ask'), MARKET.max);
  assert.equal(num('max_lots'), MARKET.lots);
  // check в таблице тоже должен знать те же границы
  assert.ok(sql.includes(`ask between ${MARKET.min} and ${MARKET.max}`));
});

test('комиссия: округляется вниз, продавец не получает больше цены', () => {
  assert.equal(marketFee(1000), 50);
  assert.equal(marketFee(1999), 99);      // floor(99.95)
  assert.equal(marketFee(1e9), 5e7);
  for (const ask of [1000, 1234, 99999, 5e6, 3e9, 1e11]) {
    const fee = marketFee(ask);
    assert.ok(fee > 0 && fee < ask && ask - fee >= ask * (1 - MARKET.fee / 100) - 1);
  }
});

test('граница цены: максимум безопасно помещается в число JS и в bigint', () => {
  assert.ok(MARKET.max < Number.MAX_SAFE_INTEGER);
  assert.ok(MARKET.max < 9.2e18);
});

test('ввод цены: числа, пробелы, суффиксы к / м / млрд', () => {
  assert.equal(parseAsk('1500000'), 1500000);
  assert.equal(parseAsk('1 500 000'), 1500000);
  assert.equal(parseAsk('250к'), 250000);
  assert.equal(parseAsk('250K'), 250000);
  assert.equal(parseAsk('1.5м'), 1500000);
  assert.equal(parseAsk('1,5 млн'), 1500000);
  assert.equal(parseAsk('2млрд'), 2e9);
  assert.equal(parseAsk('0.5b'), 5e8);
  for (const bad of ['', 'abc', '12 абв', '-5', '1..5м', null, undefined]) assert.equal(parseAsk(bad), 0, String(bad));
});

test('права: каждая функция рынка выдана только authenticated, таблицы закрыты', () => {
  const fns = ['market_list_plate(bigint, bigint)', 'market_cancel(bigint)', 'market_buy(bigint)', 'market_browse(int, text, int)', 'market_mine()', 'market_ack_sales(bigint)'];
  const grant = sql.match(/grant execute on function([\s\S]*?)to authenticated;/)[1];
  const revoke = sql.match(/revoke execute on function([\s\S]*?)from public, anon;/)[1];
  for (const f of fns) {
    assert.ok(grant.includes(`public.${f}`), `нет grant для ${f}`);
    assert.ok(revoke.includes(`public.${f}`), `нет revoke для ${f}`);
    assert.ok(sql.includes(`create or replace function public.${f.split('(')[0]}(`), `нет функции ${f}`);
  }
  assert.ok(/alter table public\.market_listings enable row level security/.test(sql));
  assert.ok(/alter table public\.market_sales\s+enable row level security/.test(sql));
  assert.ok(/revoke all on public\.market_listings, public\.market_sales from anon, authenticated/.test(sql));
});

test('все функции рынка проверяют вход и работают с правами владельца с узким search_path', () => {
  const bodies = sql.split('create or replace function ').slice(1);
  for (const b of bodies) {
    const name = b.slice(0, b.indexOf('('));
    assert.ok(/security definer set search_path = public/.test(b), `${name}: нет security definer`);
    if (name !== 'public.reset_progress') assert.ok(/auth\.uid\(\) is null/.test(b), `${name}: нет проверки входа`);
  }
});

test('покупка: блокировки в одном порядке и комиссия из константы', () => {
  const buy = sql.slice(sql.indexOf('function public.market_buy'), sql.indexOf('function public.market_browse'));
  assert.ok(/from market_listings where id = p_id for update/.test(buy), 'лот не блокируется');
  assert.ok(/order by id for update/.test(buy), 'игроки блокируются не по порядку id');
  assert.ok(/l\.ask - fee/.test(buy) && /fee_pct/.test(buy));
  assert.ok(/own lot/.test(buy) && /not enough rub/.test(buy) && /collection full/.test(buy));
});

test('сброс прогресса очищает рынок и не теряет гараж', () => {
  const rp = sql.slice(sql.indexOf('function public.reset_progress'));
  assert.ok(/delete from market_listings where seller = auth\.uid\(\)/.test(rp));
  assert.ok(/cars = '\{\}'/.test(rp));
});
