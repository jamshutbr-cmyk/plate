// Аукцион: сверка констант config.js с supabase/auction.sql, правила ставок и надёжность расчёта.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUCTION, auctionFee, auctionNext} from '../js/config.js';

const sql = readFileSync(new URL('../supabase/auction.sql', import.meta.url), 'utf8');
const num = (name) => {
  const m = sql.match(new RegExp(`${name}\\s+constant\\s+\\w+\\s*:=\\s*(\\d+)`));
  assert.ok(m, `нет константы ${name} в auction.sql`);
  return Number(m[1]);
};
const fn = (name) => {
  const i = sql.indexOf(`function public.${name}(`);
  assert.ok(i >= 0, `нет функции ${name}`);
  const j = sql.indexOf('end $$;', i);
  return sql.slice(i, j);
};

test('константы аукциона: config.js и auction.sql совпадают', () => {
  assert.equal(num('fee_pct'), AUCTION.fee);
  assert.equal(num('min_ask'), AUCTION.min);
  assert.equal(num('max_ask'), AUCTION.max);
  assert.equal(num('max_lots'), AUCTION.lots);
  assert.equal(num('step_pct'), AUCTION.stepPct);
  assert.equal(num('min_step'), AUCTION.step);
  assert.equal(num('snipe_s'), AUCTION.snipe);
  assert.equal(num('ext_max_s'), AUCTION.extMax);
  assert.ok(sql.includes(`start_price between ${AUCTION.min} and ${AUCTION.max}`));
  assert.ok(sql.includes(`p_hours not in (${AUCTION.hours.join(', ')})`));
  // та же формула шага в ленте (nx), иначе клиент покажет не тот минимум
  assert.ok(sql.includes(`a.bid::numeric * ${AUCTION.stepPct} / 100)::bigint, ${AUCTION.step})`));
});

test('шаг ставки: старт без надбавки, дальше max(5%, 100 ₽)', () => {
  assert.equal(auctionNext(5000, false), 5000);
  assert.equal(auctionNext(1000, true), 1100);      // 5% = 50 < 100
  assert.equal(auctionNext(10000, true), 10500);
  assert.equal(auctionNext(1e9, true), 1.05e9);
  assert.equal(auctionNext(2001, true), 2001 + 101); // ceil(100.05)
});

test('комиссия аукциона как на рынке: вниз, продавец не получает больше ставки', () => {
  assert.equal(auctionFee(1000), 50);
  assert.equal(auctionFee(1999), 99);
  assert.ok(AUCTION.max < Number.MAX_SAFE_INTEGER);
});

test('права: функции выданы только authenticated, служебные закрыты, таблицы под RLS', () => {
  const pub = ['auction_create(bigint, bigint, int)', 'auction_cancel(bigint)', 'auction_bid(bigint, bigint)', 'auction_browse(int, text, int)', 'auction_mine()', 'auction_ack(bigint)'];
  const grant = sql.match(/grant execute on function([\s\S]*?)to authenticated;/)[1];
  for (const f of pub) assert.ok(grant.includes(`public.${f}`), `нет grant для ${f}`);
  const closed = sql.match(/revoke execute on function public\.auction_settle\(bigint\)([\s\S]*?)from public, anon, authenticated;/);
  assert.ok(closed && closed[1].includes('auction_settle_due()') && closed[1].includes('auction_reset(uuid)'));
  assert.ok(/alter table public\.auctions\s+enable row level security/.test(sql));
  assert.ok(/alter table public\.auction_events enable row level security/.test(sql));
  assert.ok(/revoke all on public\.auctions, public\.auction_events from anon, authenticated/.test(sql));
});

test('все функции: security definer с узким search_path, публичные проверяют вход', () => {
  const bodies = sql.split('create or replace function ').slice(1);
  assert.ok(bodies.length >= 9);
  for (const b of bodies) {
    const name = b.slice(0, b.indexOf('('));
    assert.ok(/security definer set search_path = public/.test(b), `${name}: нет security definer`);
    if (!/auction_(settle|settle_due|reset)$/.test(name)) assert.ok(/auth\.uid\(\) is null/.test(b), `${name}: нет проверки входа`);
  }
});

test('ставка: лот блокируется, игроки по порядку id, деньги замораживаются, прежнему лидеру возврат', () => {
  const b = fn('auction_bid');
  assert.ok(/from auctions where id = p_id for update/.test(b));
  assert.ok(/order by id for update/.test(b));
  assert.ok(/balance = balance - p_amount/.test(b), 'ставка не замораживается');
  assert.ok(/balance = balance \+ a\.bid where id = a\.bidder/.test(b), 'нет возврата прежнему лидеру');
  for (const e of ['own lot', 'already top', 'too low', 'not enough rub', 'collection full', 'gone']) assert.ok(b.includes(e), e);
});

test('анти-снайпинг: перенос только в последние секунды, не выше потолка, конец не сдвигается назад', () => {
  const b = fn('auction_bid');
  assert.ok(/a\.ends_at - now\(\) < make_interval\(secs => snipe_s\)/.test(b));
  assert.ok(/least\(now\(\) \+ make_interval\(secs => snipe_s\), a\.orig_end \+ make_interval\(secs => ext_max_s\)\)/.test(b));
  assert.ok(/greatest\(new_end, a\.ends_at\)/.test(b));
});

test('расчёт: номер и деньги в одной функции, комиссия из константы, нет ставок: номер возвращается', () => {
  const s = fn('auction_settle');
  assert.ok(/a\.ends_at > now\(\) then return/.test(s), 'можно закрыть лот раньше срока');
  assert.ok(/balance \+ \(a\.bid - fee\)/.test(s) && /fee_pct/.test(s));
  assert.ok(/values \(a\.bidder,/.test(s), 'номер не уходит победителю');
  assert.ok(/values \(a\.seller,/.test(s), 'номер не возвращается продавцу');
  assert.ok(/delete from auctions where id = a\.id/.test(s));
  assert.ok(!/raise exception/.test(s), 'расчёт не должен падать и откатываться');
});

test('снять лот нельзя после первой ставки; ставка на закрытый лот закрывает его, а не откатывает', () => {
  const c = fn('auction_cancel');
  assert.ok(/a\.bids > 0 then raise exception 'has bids'/.test(c));
  const b = fn('auction_bid');
  assert.ok(/a\.ends_at <= now\(\) then perform public\.auction_settle\(a\.id\); return jsonb_build_object\('ended', true\)/.test(b));
});

test('сброс прогресса и перерождение учитывают аукционы', () => {
  const pr = readFileSync(new URL('../supabase/prestige.sql', import.meta.url), 'utf8');
  const mk = readFileSync(new URL('../supabase/market.sql', import.meta.url), 'utf8');
  assert.ok(pr.includes("auction_reset(uuid)") && mk.includes("auction_reset(uuid)"));
  assert.ok(/from auctions where seller = p\.id or bidder = p\.id/.test(pr), 'перерождение не блокируется активными торгами');
  const r = fn('auction_reset');
  assert.ok(/balance = balance \+ a\.bid where id = a\.bidder/.test(r), 'ставка лидера при сбросе лота не возвращается');
});
