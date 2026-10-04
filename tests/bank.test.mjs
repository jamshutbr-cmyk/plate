// Банк: сверка констант config.js с supabase/bank.sql, проценты вкладов, права на функции.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BANK, SHOP, depPayout, itemOf} from '../js/config.js';

const sql = readFileSync(new URL('../supabase/bank.sql', import.meta.url), 'utf8');
const num = (name) => {
  const m = sql.match(new RegExp(`${name}\\s+constant\\s+\\w+\\s*:=\\s*(\\d+)`));
  assert.ok(m, `нет константы ${name} в bank.sql`);
  return Number(m[1]);
};

test('курсы и лимиты обмена, вкладов, буста и слотов совпадают с bank.sql', () => {
  assert.equal(num('usd_buy'), BANK.usdBuy);
  assert.equal(num('usd_sell'), BANK.usdSell);
  assert.ok(BANK.usdSell < BANK.usdBuy, 'продавать выгоднее, чем покупать: арбитраж');
  assert.equal(num('max_op'), BANK.exMax);
  assert.equal(num('max_dep'), BANK.maxDep);
  assert.equal(num('min_rub'), BANK.depRub.min);
  assert.equal(num('max_rub'), BANK.depRub.max);
  assert.equal(num('min_usd'), BANK.depUsd.min);
  assert.equal(num('max_usd'), BANK.depUsd.max);
  assert.equal(num('luck_cost'), BANK.luck.cost);
  assert.equal(num('luck_rolls'), BANK.luck.rolls);
  assert.equal(num('luck_cap'), BANK.luck.cap);
  assert.equal(num('lots_cost'), BANK.lots.cost);
  assert.equal(num('lots_step'), BANK.lots.step);
  assert.equal(num('lots_max'), BANK.lots.max);
});

test('проценты вкладов: те же, что в bank_deposit_open', () => {
  const m = sql.match(/pct := case when p_cur = 'rub' then case p_days when 1 then (\d+) when 3 then (\d+) when 7 then (\d+) end\s+else case p_days when 1 then (\d+) when 3 then (\d+) when 7 then (\d+) end end;/);
  assert.ok(m, 'не нашли таблицу процентов');
  const [r1, r3, r7, u1, u3, u7] = m.slice(1).map(Number);
  assert.deepEqual(BANK.depRub.pct, {1: r1, 3: r3, 7: r7});
  assert.deepEqual(BANK.depUsd.pct, {1: u1, 3: u3, 7: u7});
});

test('выплата вклада: дробная часть процента отбрасывается', () => {
  assert.equal(depPayout('rub', 1000000, 1), 1020000);
  assert.equal(depPayout('rub', 100000, 7), 120000);
  assert.equal(depPayout('usd', 10, 3), 11);       // 10 * 12 / 100 = 1,2 → 1
  assert.equal(depPayout('usd', 10, 7), 13);
  assert.ok(depPayout('usd', BANK.depUsd.min, 1) >= BANK.depUsd.min);
  assert.ok(depPayout('rub', BANK.depRub.max, 7) < Number.MAX_SAFE_INTEGER);
});

test('кейсы и титулы: цены и веса совпадают с bank.sql, сумма весов 100', () => {
  const cs = [...sql.matchAll(/\('(\w+)', (\d+), ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/g)]
    .filter((m) => BANK.cases.some((c) => c.id === m[1]));
  assert.equal(cs.length, BANK.cases.length);
  for (const m of cs) {
    const c = BANK.cases.find((x) => x.id === m[1]);
    assert.equal(+m[2], c.usd, c.id);
    assert.deepEqual(m.slice(3).map(Number), c.w, c.id);
    assert.equal(c.w.reduce((a, b) => a + b, 0), 100, c.id);
  }
  const it = sql.match(/insert into public\.bank_items \(id, usd\) values ([^\n]+)/)[1];
  for (const x of BANK.items) assert.ok(it.includes(`('${x.id}', ${x.usd})`), `титул ${x.id}`);
  assert.equal(BANK.items.length, (it.match(/\(/g) || []).length);
});

test('тираж титулов: max в config.js совпадает с supply в bank.sql, покупка проверяет тираж под блокировкой', () => {
  const upd = sql.match(/update public\.bank_items set supply = case id ([^;]+) end;/);
  assert.ok(upd, 'нет заливки supply');
  for (const x of BANK.items) {
    assert.ok(x.max > 0, `у титула ${x.id} нет тиража`);
    assert.ok(new RegExp(`when '${x.id}' then ${x.max}\\b`).test(upd[1]), `тираж ${x.id}`);
  }
  const fn = sql.slice(sql.indexOf('create or replace function public.bank_buy_item'), sql.indexOf('create or replace function public.open_case_usd'));
  assert.ok(/from bank_items where id = p_item for update/.test(fn), 'строка титула не блокируется');
  assert.ok(fn.indexOf('from bank_items where id = p_item for update') < fn.indexOf('from players where id = auth.uid() for update'));
  assert.ok(/sold >= it\.supply then raise exception 'sold out'/.test(fn));
  assert.ok(/update bank_items set sold = sold \+ 1/.test(fn));
  assert.ok(/'items', \(select coalesce\(jsonb_object_agg/.test(sql), 'bank_state не отдаёт тираж');
});

test('титулы банка находятся через itemOf, но не входят в SHOP (за рубли не купить)', () => {
  for (const x of BANK.items) {
    assert.ok(!SHOP.title.some((t) => t.id === x.id), x.id);
    assert.deepEqual(itemOf(x.id), {id: x.id, n: x.n, c: x.c, slot: 'title'});
  }
  assert.equal(itemOf('driver').slot, 'title');
});

test('права: consume_luck и bank_reset только service_role / никому, остальное authenticated', () => {
  const fns = ['bank_state()', 'bank_exchange(text, int)', 'bank_deposit_open(text, bigint, int)', 'bank_deposit_claim(bigint)', 'bank_buy_luck()', 'bank_buy_lots()', 'bank_buy_item(text)', 'open_case_usd(text)'];
  const grant = sql.match(/grant execute on function([\s\S]*?)to authenticated;/)[1];
  const revoke = sql.match(/revoke execute on function([\s\S]*?)from public, anon;/)[1];
  for (const f of fns) {
    assert.ok(grant.includes(`public.${f}`), `нет grant для ${f}`);
    assert.ok(revoke.includes(`public.${f}`), `нет revoke для ${f}`);
  }
  assert.ok(/revoke execute on function public\.consume_luck\(uuid\), public\.bank_reset\(uuid\) from public, anon, authenticated;/.test(sql));
  assert.ok(/grant\s+execute on function public\.consume_luck\(uuid\) to service_role;/.test(sql));
  assert.ok(!/grant execute on function public\.bank_reset/.test(sql));
});

test('все функции банка: security definer с узким search_path и проверка входа', () => {
  const bodies = sql.split('create or replace function ').slice(1);
  assert.ok(bodies.length >= 10);
  for (const b of bodies) {
    const name = b.slice(0, b.indexOf('('));
    assert.ok(/security definer set search_path = public/.test(b), `${name}: нет security definer`);
    if (!['public.consume_luck', 'public.bank_reset'].includes(name)) assert.ok(/auth\.uid\(\) is null/.test(b), `${name}: нет проверки входа`);
  }
});

test('в bank.sql нет case ... then внутри условия if (PL/pgSQL режет if по первому then)', () => {
  for (const m of sql.matchAll(/^\s*(?:els)?if\b([^;]*?)\bthen\b/gm)) assert.ok(!/\bcase\b/.test(m[1]), m[0]);
});

test('generate: читает luck, берёт лучший из 3 и списывает прокрут через consume_luck', () => {
  const ts = readFileSync(new URL('../supabase/functions/generate/index.ts', import.meta.url), 'utf8');
  assert.ok(/select\('country, reg, luck'\)/.test(ts));
  assert.ok(/const tries = pl\.luck > 0 \? (\d+) : 1/.test(ts));
  assert.equal(+ts.match(/pl\.luck > 0 \? (\d+) : 1/)[1], BANK.luck.best);
  assert.ok(/consume_luck/.test(ts) && ts.indexOf('commit_plate_fee') < ts.indexOf('consume_luck'));
});
