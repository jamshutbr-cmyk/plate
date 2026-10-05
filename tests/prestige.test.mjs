// Перерождение: сверка констант config.js с supabase/prestige.sql, формулы, права, кэш клиента.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRESTIGE, SELL_PCT, perkCost, rebNeed, rebStars, sellGain} from '../js/config.js';
import {playerToState} from '../js/state.js';

const sql = readFileSync(new URL('../supabase/prestige.sql', import.meta.url), 'utf8');
const num = (name) => {
  const m = sql.match(new RegExp(`${name}\\s+constant\\s+\\w+\\s*:=\\s*(\\d+)`));
  assert.ok(m, `нет константы ${name} в prestige.sql`);
  return Number(m[1]);
};

test('константы перерождения: config.js и prestige.sql совпадают', () => {
  assert.equal(num('reb_lvl_base'), PRESTIGE.lvlBase);
  assert.equal(num('reb_lvl_step'), PRESTIGE.lvlStep);
  assert.equal(num('stars_div'), PRESTIGE.starsDiv);
  assert.equal(num('cash_step'), PRESTIGE.cashStep);
  assert.equal(num('usd_step'), PRESTIGE.usdStep);
});

test('максимумы бонусов совпадают с buy_perk', () => {
  const m = sql.match(/case k when 'sell' then (\d+) when 'cash' then (\d+) when 'usd' then (\d+)/);
  assert.ok(m, 'нет таблицы максимумов в buy_perk');
  const mx = Object.fromEntries(PRESTIGE.perks.map((p) => [p.k, p.max]));
  assert.deepEqual([mx.sell, mx.cash, mx.usd], [+m[1], +m[2], +m[3]]);
});

test('порог и награда', () => {
  assert.equal(rebNeed(0), 10); assert.equal(rebNeed(1), 15); assert.equal(rebNeed(4), 30);
  assert.equal(rebStars(10), 2); assert.equal(rebStars(14), 2); assert.equal(rebStars(30), 6);
  assert.ok(rebStars(rebNeed(0)) >= 1, 'на пороге награда не нулевая');
});

test('бонус продажи не выводит выплату за 100% цены', () => {
  const max = PRESTIGE.perks.find((p) => p.k == 'sell').max;
  assert.equal(SELL_PCT + max, 100);
  assert.ok(sql.includes('least(5,'), 'sell_pct должен ограничивать бонус');
  assert.equal(sellGain(1000), 950);
  assert.equal(sellGain(1000, 5), 1000);
});

test('цена бонуса растёт: уровень n стоит n звёзд', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(perkCost), [1, 2, 3, 4, 5]);
  for (const p of PRESTIGE.perks) {
    let total = 0; for (let l = 0; l < p.max; l++) total += perkCost(l);
    assert.ok(total >= p.max, 'полная прокачка не дешевле числа уровней');
  }
});

test('сервер защищает перерождение: лоты, вклады, права', () => {
  assert.ok(sql.includes("raise exception 'level too low'"));
  assert.ok(sql.includes("raise exception 'has listings'"));
  assert.ok(sql.includes("raise exception 'has deposits'"));
  assert.ok(sql.includes("raise exception 'not enough stars'"));
  assert.ok(/revoke execute on function public\.sell_pct\(uuid\)[^;]*authenticated/.test(sql), 'sell_pct не должна быть доступна клиенту');
  assert.ok(/grant\s+execute on function public\.rebirth\(\), public\.buy_perk\(text\) to authenticated/.test(sql));
  // клиент не может сам вписать звёзды: прямых прав на players нет (schema.sql), а в rebirth перерождения не накручиваются
  assert.ok(sql.includes('rebirths = rebirths + 1'));
});

test('reset_progress обнуляет престиж', () => {
  const f = sql.slice(sql.indexOf('function public.reset_progress'));
  assert.ok(f.includes("rebirths = 0, stars = 0, perks = '{\"sell\":0,\"cash\":0,\"usd\":0}'"));
});

test('playerToState: поля перерождения и значения по умолчанию', () => {
  const s = playerToState({rebirths: 3, stars: 7, perks: {sell: 2}});
  assert.equal(s.rb, 3); assert.equal(s.stars, 7);
  assert.deepEqual(s.perks, {sell: 2, cash: 0, usd: 0});
  const d = playerToState({});
  assert.equal(d.rb, 0); assert.equal(d.stars, 0); assert.deepEqual(d.perks, {sell: 0, cash: 0, usd: 0});
});
