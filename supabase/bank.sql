-- Банк: обмен ₽ ↔ $, вклады, усиления за $ (буст удачи, слоты рынка), кейсы за $ и эксклюзивные титулы ограниченным тиражом.
-- Выполнять в SQL Editor ПОСЛЕДНИМ: после schema.sql, seed_regions.sql, shop.sql, cases.sql и market.sql. Можно запускать повторно.
-- Все цены, проценты и лимиты живут ТОЛЬКО здесь (константы в функциях); зеркало для показа: BANK в js/config.js,
-- сверяет tests/bank.test.mjs. Клиент ничего не считает: он вызывает функции и показывает результат.
-- Буст удачи читает Edge Function generate (колонка players.luck): её нужно задеплоить заново.

alter table public.players add column if not exists luck int not null default 0 check (luck >= 0);          -- сколько прокрутов осталось с бустом
alter table public.players add column if not exists extra_lots int not null default 0 check (extra_lots >= 0); -- то же, что в market.sql

-- ---------- Вклады ----------
create table if not exists public.bank_deposits (
  id         bigserial primary key,
  owner      uuid   not null references public.players(id) on delete cascade,
  cur        text   not null check (cur in ('rub', 'usd')),
  amount     bigint not null check (amount > 0),
  payout     bigint not null check (payout > amount),
  ends_at    timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists bank_deposits_owner on public.bank_deposits (owner);
alter table public.bank_deposits enable row level security;
revoke all on public.bank_deposits from anon, authenticated;

-- ---------- Кейсы за $ (шансы классов 0..4 в процентах, сумма строго 100) ----------
create table if not exists public.bank_cases (
  id  text primary key,
  usd int not null check (usd > 0),
  w0 numeric not null check (w0 >= 0), w1 numeric not null check (w1 >= 0), w2 numeric not null check (w2 >= 0),
  w3 numeric not null check (w3 >= 0), w4 numeric not null check (w4 >= 0),
  check (w0 + w1 + w2 + w3 + w4 = 100)
);
alter table public.bank_cases enable row level security;
drop policy if exists bank_cases_read on public.bank_cases;
create policy bank_cases_read on public.bank_cases for select using (true);
revoke insert, update, delete on public.bank_cases from anon, authenticated;
insert into public.bank_cases (id, usd, w0, w1, w2, w3, w4) values
  ('vip', 25, 0, 10, 50, 40, 0),
  ('royal', 120, 0, 0, 20, 60, 20)
on conflict (id) do update set usd = excluded.usd, w0 = excluded.w0, w1 = excluded.w1, w2 = excluded.w2, w3 = excluded.w3, w4 = excluded.w4;
delete from public.bank_cases where id <> all (array['vip', 'royal']);

-- ---------- Эксклюзивы за $ (титулы) ----------
-- Строка в shop_items нужна только чтобы работал equip_item; цена там заведомо недостижима, за рубли их не купить.
create table if not exists public.bank_items (
  id  text primary key,
  usd int not null check (usd > 0)
);
alter table public.bank_items add column if not exists supply int check (supply > 0);            -- тираж: сколько всего можно купить (null = без ограничений)
alter table public.bank_items add column if not exists sold int not null default 0 check (sold >= 0);  -- сколько уже куплено всеми игроками
alter table public.bank_items enable row level security;
drop policy if exists bank_items_read on public.bank_items;
create policy bank_items_read on public.bank_items for select using (true);
revoke insert, update, delete on public.bank_items from anon, authenticated;
insert into public.bank_items (id, usd) values ('banker', 150), ('tycoon', 600), ('whale', 2000)
on conflict (id) do update set usd = excluded.usd;
delete from public.bank_items where id <> all (array['banker', 'tycoon', 'whale']);
-- Лимитированный тираж (на весь сервер). sold не трогаем: повторный запуск файла счётчик не сбрасывает.
update public.bank_items set supply = case id when 'banker' then 500 when 'tycoon' then 100 when 'whale' then 10 end;
insert into public.shop_items (id, slot, price) values
  ('banker', 'title', 1000000000000000), ('tycoon', 'title', 1000000000000000), ('whale', 'title', 1000000000000000)
on conflict (id) do nothing;

-- ---------- Состояние банка ----------
create or replace function public.bank_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p players%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into p from players where id = auth.uid();
  if not found then raise exception 'no player'; end if;
  return jsonb_build_object(
    'luck', p.luck, 'extra_lots', p.extra_lots,
    'now', (extract(epoch from now()) * 1000)::bigint,
    'items', (select coalesce(jsonb_object_agg(i.id, jsonb_build_object('supply', i.supply, 'sold', i.sold)), '{}'::jsonb) from bank_items i),
    'deposits', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'cur', d.cur, 'amount', d.amount, 'payout', d.payout,
                   'start', (extract(epoch from d.created_at) * 1000)::bigint, 'ends', (extract(epoch from d.ends_at) * 1000)::bigint) order by d.ends_at), '[]'::jsonb)
                 from bank_deposits d where d.owner = p.id));
end $$;

-- ---------- Обмен ₽ ↔ $ ----------
-- 'buy': p_amount долларов за рубли по курсу usd_buy; 'sell': p_amount долларов в рубли по курсу usd_sell (курс продажи ниже).
create or replace function public.bank_exchange(p_dir text, p_amount int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; rub bigint;
  usd_buy  constant bigint := 250000;
  usd_sell constant bigint := 150000;
  max_op   constant int    := 100000;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_amount is null or p_amount < 1 or p_amount > max_op then raise exception 'bad amount'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if p_dir = 'buy' then
    rub := p_amount * usd_buy;
    if p.balance < rub then raise exception 'not enough rub'; end if;
    update players set balance = balance - rub, usd = usd + p_amount where id = p.id;
  elsif p_dir = 'sell' then
    if p.usd < p_amount then raise exception 'not enough usd'; end if;
    rub := p_amount * usd_sell;
    update players set balance = balance + rub, usd = usd - p_amount where id = p.id;
  else
    raise exception 'bad dir';
  end if;
  return jsonb_build_object('rub', rub, 'usd', p_amount);
end $$;

-- ---------- Вклады ----------
-- Срок 1 / 3 / 7 дней. Проценты: ₽ 2 / 8 / 20, $ 4 / 12 / 30 (дробная часть отбрасывается). Раньше срока забрать нельзя.
create or replace function public.bank_deposit_open(p_cur text, p_amount bigint, p_days int) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; pct int; payout bigint; new_id bigint; lo bigint; hi bigint;
  max_dep  constant int    := 3;
  min_rub  constant bigint := 100000;
  max_rub  constant bigint := 10000000000;
  min_usd  constant bigint := 10;
  max_usd  constant bigint := 1000000;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_cur not in ('rub', 'usd') then raise exception 'bad cur'; end if;
  pct := case when p_cur = 'rub' then case p_days when 1 then 2 when 3 then 8 when 7 then 20 end
              else case p_days when 1 then 4 when 3 then 12 when 7 then 30 end end;
  if pct is null then raise exception 'bad term'; end if;
  lo := case when p_cur = 'rub' then min_rub else min_usd end;
  hi := case when p_cur = 'rub' then max_rub else max_usd end;
  if p_amount is null or p_amount < lo or p_amount > hi then raise exception 'bad amount'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if (select count(*) from bank_deposits where owner = p.id) >= max_dep then raise exception 'too many'; end if;
  if p_cur = 'rub' then
    if p.balance < p_amount then raise exception 'not enough rub'; end if;
    update players set balance = balance - p_amount where id = p.id;
  else
    if p.usd < p_amount then raise exception 'not enough usd'; end if;
    update players set usd = usd - p_amount::int where id = p.id;
  end if;
  payout := p_amount + floor(p_amount::numeric * pct / 100)::bigint;
  if payout <= p_amount then raise exception 'bad amount'; end if;   -- сумма слишком мала, чтобы проценты дали хотя бы 1
  insert into bank_deposits (owner, cur, amount, payout, ends_at)
  values (p.id, p_cur, p_amount, payout, now() + make_interval(days => p_days))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.bank_deposit_claim(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d bank_deposits%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform 1 from players where id = auth.uid() for update;
  select * into d from bank_deposits where id = p_id and owner = auth.uid() for update;
  if not found then raise exception 'gone'; end if;
  if d.ends_at > now() then raise exception 'not ready'; end if;
  if d.cur = 'rub' then
    update players set balance = balance + d.payout where id = d.owner;
  else
    update players set usd = usd + d.payout::int where id = d.owner;
  end if;
  delete from bank_deposits where id = d.id;
  return jsonb_build_object('cur', d.cur, 'payout', d.payout);
end $$;

-- ---------- Усиления за $ ----------
-- Буст удачи: luck_rolls ближайших прокрутов генерируют 3 номера и выдают самый дорогой (Edge Function generate).
create or replace function public.bank_buy_luck() returns int
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; res int;
  luck_cost  constant int := 15;
  luck_rolls constant int := 10;
  luck_cap   constant int := 100;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if p.usd < luck_cost then raise exception 'not enough usd'; end if;
  if p.luck + luck_rolls > luck_cap then raise exception 'limit'; end if;
  update players set usd = usd - luck_cost, luck = luck + luck_rolls where id = p.id returning luck into res;
  return res;
end $$;

-- Слоты рынка: +lots_step лотов за покупку, не больше lots_max дополнительных.
create or replace function public.bank_buy_lots() returns int
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; res int;
  lots_cost constant int := 40;
  lots_step constant int := 5;
  lots_max  constant int := 20;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if p.extra_lots + lots_step > lots_max then raise exception 'limit'; end if;
  if p.usd < lots_cost then raise exception 'not enough usd'; end if;
  update players set usd = usd - lots_cost, extra_lots = extra_lots + lots_step where id = p.id returning extra_lots into res;
  return res;
end $$;

-- Списать один прокрут буста. Зовёт ТОЛЬКО Edge Function generate (service_role) после успешной выдачи номера.
create or replace function public.consume_luck(uid uuid) returns void
language sql security definer set search_path = public as $$
  update players set luck = greatest(luck - 1, 0) where id = uid;
$$;

-- ---------- Эксклюзивный титул за $ ----------
create or replace function public.bank_buy_item(p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; it bank_items%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  -- Строку титула блокируем первой: покупки одного титула идут по очереди, тираж не превысить даже при одновременных нажатиях.
  select * into it from bank_items where id = p_item for update;
  if not found then raise exception 'bad item'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if p_item = any(p.owned) then raise exception 'already owned'; end if;
  if it.supply is not null and it.sold >= it.supply then raise exception 'sold out'; end if;
  if p.usd < it.usd then raise exception 'not enough usd'; end if;
  update players set usd = usd - it.usd, owned = owned || p_item where id = p.id;
  update bank_items set sold = sold + 1 where id = it.id;
end $$;

-- ---------- Кейс за $ ----------
-- Так же, как open_case (cases.sql), но платит $. Дубликат возвращает dup_pct % стоимости класса в рублях.
create or replace function public.open_case_usd(case_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; c bank_cases%rowtype;
  w numeric[]; tot numeric := 0; roll numeric; acc numeric := 0;
  cls int := -1; last_cls int := -1; pick text; dup boolean; refund bigint := 0;
  new_bal bigint; new_usd int; new_cars text[];
  dup_pct constant int := 50;
  i int;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into c from bank_cases where id = case_id;
  if not found then raise exception 'bad case'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if p.usd < c.usd then raise exception 'not enough usd'; end if;

  w := array[c.w0, c.w1, c.w2, c.w3, c.w4];
  for i in 1..5 loop
    if not exists (select 1 from car_defs d where d.r = i - 1) then w[i] := 0; end if;
    tot := tot + w[i];
  end loop;
  if tot <= 0 then raise exception 'no cars'; end if;

  roll := random()::numeric * tot;
  for i in 1..5 loop
    if w[i] > 0 then
      last_cls := i - 1;
      acc := acc + w[i];
      if cls < 0 and roll < acc then cls := i - 1; end if;
    end if;
  end loop;
  if cls < 0 then cls := last_cls; end if;

  select d.id into pick from car_defs d where d.r = cls order by random() limit 1;
  dup := pick = any(p.cars);
  if dup then select k.val * dup_pct / 100 into refund from car_classes k where k.r = cls; end if;

  update players set usd = usd - c.usd, balance = balance + refund,
                     cars = case when dup then cars else cars || pick end
  where id = p.id
  returning balance, usd, cars into new_bal, new_usd, new_cars;

  return jsonb_build_object('car_id', pick, 'cls', cls, 'dup', dup, 'refund', refund,
                            'player', jsonb_build_object('balance', new_bal, 'usd', new_usd, 'cars', to_jsonb(new_cars)));
end $$;

-- ---------- Сброс прогресса (вызывается из reset_progress в market.sql) ----------
create or replace function public.bank_reset(uid uuid) returns void
language sql security definer set search_path = public as $$
  delete from bank_deposits where owner = uid;
  update players set luck = 0 where id = uid;
$$;

-- ---------- Права ----------
revoke execute on function
  public.bank_state(), public.bank_exchange(text, int), public.bank_deposit_open(text, bigint, int), public.bank_deposit_claim(bigint),
  public.bank_buy_luck(), public.bank_buy_lots(), public.bank_buy_item(text), public.open_case_usd(text)
from public, anon;
grant execute on function
  public.bank_state(), public.bank_exchange(text, int), public.bank_deposit_open(text, bigint, int), public.bank_deposit_claim(bigint),
  public.bank_buy_luck(), public.bank_buy_lots(), public.bank_buy_item(text), public.open_case_usd(text)
to authenticated;
revoke execute on function public.consume_luck(uuid), public.bank_reset(uuid) from public, anon, authenticated;
grant  execute on function public.consume_luck(uuid) to service_role;
