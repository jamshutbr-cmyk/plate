-- Рынок: игроки продают номера друг другу за рубли.
-- Выполнять в SQL Editor ПОСЛЕДНИМ: после schema.sql, seed_regions.sql, shop.sql (+ shop_v2.sql) и cases.sql.
-- Файл переопределяет reset_progress (версия из cases.sql + очистка рынка), поэтому после него cases.sql повторно не запускать.
-- Можно запускать повторно.
--
-- Как это работает:
--  * выставленный номер переезжает из plates в market_listings, поэтому его нельзя продать, обменять или автопродать;
--  * при покупке (или снятии с рынка) номер возвращается в plates уже новому владельцу (у номера новый id);
--  * покупатель платит цену лота, продавец получает её минус комиссия (она просто исчезает из игры, это «слив» денег);
--  * всё в одной транзакции под блокировками, двойной покупки и потери номера быть не может.
-- Константы (зеркало MARKET в js/config.js, сверяет tests/market.test.mjs): fee_pct, min_ask, max_ask, max_lots.

-- ---------- Лоты ----------
create table if not exists public.market_listings (
  id           bigint generated always as identity primary key,
  seller       uuid not null references public.players(id) on delete cascade,
  country      text not null check (country in ('RU','BY')),
  type         text not null check (type in ('civil','taxi','police')),
  main         text not null,
  reg          text not null,
  region_name  text not null,
  cls          smallint not null check (cls between 0 and 4),
  mu           jsonb not null,
  price        bigint not null check (price >= 0),                -- оценка игры (как plates.price)
  ask          bigint not null check (ask between 1000 and 100000000000),   -- цена продавца, ₽
  created_at   timestamptz not null default now()
);
create index if not exists market_listings_seller_idx on public.market_listings(seller);
create index if not exists market_listings_ask_idx    on public.market_listings(ask);
create index if not exists market_listings_cls_idx    on public.market_listings(cls, id desc);

-- ---------- Продажи (чтобы продавец узнал, что его номер купили) ----------
create table if not exists public.market_sales (
  id          bigint generated always as identity primary key,
  seller      uuid not null references public.players(id) on delete cascade,
  buyer_nick  text not null default '',
  country     text not null,
  type        text not null,
  main        text not null,
  reg         text not null,
  cls         smallint not null,
  ask         bigint not null,
  fee         bigint not null,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists market_sales_seller_idx on public.market_sales(seller, seen);

-- Прямого доступа у клиента нет: читает и пишет только через функции ниже
alter table public.market_listings enable row level security;
alter table public.market_sales    enable row level security;
revoke all on public.market_listings, public.market_sales from anon, authenticated;

-- ---------- Выставить номер ----------
create or replace function public.market_list_plate(p_plate bigint, p_ask bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; pl plates%rowtype; new_id bigint;
  min_ask  constant bigint := 1000;
  max_ask  constant bigint := 100000000000;
  max_lots constant int    := 10;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_ask is null or p_ask < min_ask or p_ask > max_ask then raise exception 'bad price'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if (select count(*) from market_listings where seller = p.id) >= max_lots then raise exception 'too many'; end if;
  select * into pl from plates where id = p_plate and owner = p.id for update;
  if not found then raise exception 'bad plate'; end if;

  insert into market_listings (seller, country, type, main, reg, region_name, cls, mu, price, ask)
  values (p.id, pl.country, pl.type, pl.main, pl.reg, pl.region_name, pl.cls, pl.mu, pl.price, p_ask)
  returning id into new_id;
  delete from plates where id = pl.id;
  update players set showcase = array_remove(showcase, pl.id) where id = p.id;   -- с рынка номер в витрине не нужен
  return new_id;
end $$;

-- ---------- Снять с рынка ----------
create or replace function public.market_cancel(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare l market_listings%rowtype; cap int; cur int;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into l from market_listings where id = p_id and seller = auth.uid() for update;
  if not found then raise exception 'gone'; end if;
  select cap_c into cap from players where id = l.seller for update;
  select count(*) into cur from plates where owner = l.seller and not in_safe;
  if cur >= cap then raise exception 'collection full'; end if;

  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
  values (l.seller, l.country, l.type, l.main, l.reg, l.region_name, l.cls, l.mu, l.price);
  delete from market_listings where id = l.id;
end $$;

-- ---------- Купить ----------
-- Возвращает {main, ask, balance}. Ошибки: gone (лот уже продан или снят), own lot, not enough rub, collection full.
create or replace function public.market_buy(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l market_listings%rowtype; b players%rowtype; cur int; fee bigint;
  fee_pct constant int := 5;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into l from market_listings where id = p_id for update;
  if not found then raise exception 'gone'; end if;
  if l.seller = auth.uid() then raise exception 'own lot'; end if;
  -- Блокируем покупателя и продавца в одном порядке (по id), чтобы две встречные сделки не зависли друг на друге
  perform 1 from players where id in (l.seller, auth.uid()) order by id for update;
  select * into b from players where id = auth.uid();
  if not found then raise exception 'no player'; end if;
  if b.balance < l.ask then raise exception 'not enough rub'; end if;
  select count(*) into cur from plates where owner = b.id and not in_safe;
  if cur >= b.cap_c then raise exception 'collection full'; end if;

  fee := floor(l.ask::numeric * fee_pct / 100)::bigint;
  update players set balance = balance - l.ask         where id = b.id;
  update players set balance = balance + (l.ask - fee) where id = l.seller;
  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
  values (b.id, l.country, l.type, l.main, l.reg, l.region_name, l.cls, l.mu, l.price);
  insert into market_sales (seller, buyer_nick, country, type, main, reg, cls, ask, fee)
  values (l.seller, coalesce(nullif(b.nick, ''), 'Игрок'), l.country, l.type, l.main, l.reg, l.cls, l.ask, fee);
  delete from market_listings where id = l.id;
  return jsonb_build_object('main', l.main, 'ask', l.ask, 'balance', b.balance - l.ask);
end $$;

-- ---------- Лента лотов других игроков ----------
-- p_cls: редкость 0..4 или null (все); p_sort: 'new' | 'cheap' | 'dear'; p_off: сколько пропустить (страница 30 лотов).
create or replace function public.market_browse(p_cls int default null, p_sort text default 'new', p_off int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) - 'n' order by x.n), '[]'::jsonb)
    from (
      select row_number() over (
               order by case when p_sort = 'cheap' then l.ask end asc,
                        case when p_sort = 'dear'  then l.ask end desc,
                        l.id desc) as n,
             l.id, l.country, l.type, l.main, l.reg, l.region_name as rn, l.cls, l.price, l.ask,
             coalesce(nullif(pl.nick, ''), 'Игрок') as nick
      from market_listings l join players pl on pl.id = l.seller
      where l.seller <> auth.uid() and (p_cls is null or l.cls = p_cls)
      order by n
      limit 30 offset greatest(coalesce(p_off, 0), 0)
    ) x
  );
end $$;

-- ---------- Мои лоты и непрочитанные продажи ----------
create or replace function public.market_mine() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  return jsonb_build_object(
    'lots', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'country', l.country, 'type', l.type, 'main', l.main,
               'reg', l.reg, 'rn', l.region_name, 'cls', l.cls, 'price', l.price, 'ask', l.ask) order by l.id desc), '[]'::jsonb)
             from market_listings l where l.seller = auth.uid()),
    'sold', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'main', s.main, 'ask', s.ask, 'fee', s.fee,
               'nick', s.buyer_nick) order by s.id), '[]'::jsonb)
             from market_sales s where s.seller = auth.uid() and not s.seen)
  );
end $$;

-- Отметить продажи прочитанными (клиент передаёт наибольший id из показанных); старые прочитанные чистим
create or replace function public.market_ack_sales(p_upto bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  update market_sales set seen = true where seller = auth.uid() and id <= p_upto;
  delete from market_sales where seller = auth.uid() and seen and created_at < now() - interval '30 days';
end $$;

-- ---------- Сброс прогресса: как в cases.sql (с гаражом), плюс рынок очищается ----------
create or replace function public.reset_progress() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from plates where owner = auth.uid();
  delete from market_listings where seller = auth.uid();
  delete from market_sales where seller = auth.uid();
  update players set balance = 50000, usd = 0, xp = 0, lvl = 1, cap_c = 100, cap_s = 5,
    daily_last = null, daily_streak = 0, rescue_last = null, seen = '{}', cars = '{}',
    stats = '{"n":0,"best":0,"cls":[0,0,0,0,0],"f":{}}',
    autosell = '{"lvl":0,"on":true,"t1":true,"t2":true,"sp":true,"old":false,"cheap":false,"ceil":0,"every":false,"low":false}'
  where id = auth.uid();
end $$;

-- ---------- Права ----------
revoke execute on function
  public.market_list_plate(bigint, bigint), public.market_cancel(bigint), public.market_buy(bigint),
  public.market_browse(int, text, int), public.market_mine(), public.market_ack_sales(bigint)
from public, anon;
grant execute on function
  public.market_list_plate(bigint, bigint), public.market_cancel(bigint), public.market_buy(bigint),
  public.market_browse(int, text, int), public.market_mine(), public.market_ack_sales(bigint)
to authenticated;
revoke execute on function public.reset_progress() from public, anon;
grant  execute on function public.reset_progress() to authenticated;
