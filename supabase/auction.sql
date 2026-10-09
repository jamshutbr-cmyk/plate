-- Аукцион: продавец задаёт стартовую цену и срок, остальные игроки делают ставки.
-- Выполнять после market.sql (и bank.sql), ДО prestige.sql. Можно запускать повторно.
-- Файл ничего не переопределяет; reset_progress (market.sql / prestige.sql) вызывает auction_reset, если он есть.
--
-- Как это работает (та же надёжность, что у рынка: деньги и номер переходят одновременно, потерять нечего):
--  * выставленный номер переезжает из plates в auctions и недоступен для продажи, обмена и рынка;
--  * ставка ЗАМОРАЖИВАЕТСЯ: сумма списывается с баланса в момент ставки, а предыдущему лидеру в той же транзакции
--    возвращается его ставка. Поэтому победитель не может потратить деньги до конца торгов, а проигравший ничего не теряет;
--  * по окончании в одной транзакции под блокировкой лота: номер уходит победителю, продавец получает ставку минус комиссия
--    (она исчезает из игры, как на рынке). Нет ставок: номер возвращается продавцу;
--  * расчёт ленивый (без cron): любой вызов browse / mine / bid закрывает просроченные лоты. Клиент опрашивает auction_mine,
--    так что лот закрывается через секунды после конца. Номер победителя кладётся в коллекцию даже при полной коллекции
--    (в долг по лимиту: пока не освободит место, новые номера не выпадут), иначе его пришлось бы где-то держать;
--  * защита от накрутки: (1) анти-снайпинг: ставка в последние snipe_s секунд переносит конец на now()+snipe_s, суммарный
--    перенос не больше ext_max_s; (2) минимальный шаг ставки max(5%, 100 ₽); (3) продавец не может ставить на свой лот
--    и снять лот после первой ставки; (4) лидер не может перебивать сам себя; (5) комиссия берётся со всякой продажи,
--    поэтому «подставной» покупатель продавца только теряет деньги (деньги из воздуха не появляются).
-- Константы (зеркало AUCTION в js/config.js, сверяет tests/auction.test.mjs):
--   fee_pct, min_ask, max_ask, max_lots, step_pct, min_step, snipe_s, ext_max_s; сроки: 1, 6, 12, 24 часа.

-- ---------- Лоты ----------
create table if not exists public.auctions (
  id          bigint generated always as identity primary key,
  seller      uuid not null references public.players(id) on delete cascade,
  country     text not null check (country in ('RU','BY')),
  type        text not null check (type in ('civil','taxi','police','transit','military','diplomat','retro')),
  main        text not null,
  reg         text not null,
  region_name text not null,
  cls         smallint not null check (cls between 0 and 4),
  mu          jsonb not null,
  price       bigint not null check (price >= 0),                            -- оценка игры
  start_price bigint not null check (start_price between 1000 and 100000000000),
  bid         bigint check (bid is null or bid >= start_price),              -- текущая ставка (заморожена у bidder)
  bidder      uuid references public.players(id) on delete set null,
  bids        int not null default 0,
  ends_at     timestamptz not null,
  orig_end    timestamptz not null,                                          -- конец без переносов (потолок переноса)
  created_at  timestamptz not null default now()
);
create index if not exists auctions_seller_idx on public.auctions(seller);
create index if not exists auctions_bidder_idx on public.auctions(bidder);
create index if not exists auctions_end_idx    on public.auctions(ends_at);
create index if not exists auctions_cls_idx    on public.auctions(cls, ends_at);

-- ---------- События (продан, не продан, выиграл, перебили) ----------
create table if not exists public.auction_events (
  id         bigint generated always as identity primary key,
  player     uuid not null references public.players(id) on delete cascade,
  kind       text not null check (kind in ('sold','unsold','won','outbid')),
  main       text not null,
  amount     bigint not null default 0,
  fee        bigint not null default 0,
  seen       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists auction_events_player_idx on public.auction_events(player, seen);

alter table public.auctions       enable row level security;
alter table public.auction_events enable row level security;
revoke all on public.auctions, public.auction_events from anon, authenticated;

-- ---------- Служебное: закрыть один лот (вызывать под блокировкой лота или из auction_settle_due) ----------
create or replace function public.auction_settle(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype; fee bigint;
  fee_pct constant int := 5;
begin
  select * into a from auctions where id = p_id for update;
  if not found or a.ends_at > now() then return; end if;

  if a.bidder is null or a.bid is null then
    -- Ставок не было: номер возвращается продавцу (лимит коллекции не проверяем: номер и так его)
    insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
    values (a.seller, a.country, a.type, a.main, a.reg, a.region_name, a.cls, a.mu, a.price);
    insert into auction_events (player, kind, main) values (a.seller, 'unsold', a.main);
  else
    fee := floor(a.bid::numeric * fee_pct / 100)::bigint;
    update players set balance = balance + (a.bid - fee) where id = a.seller;      -- ставка уже была списана у победителя
    insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
    values (a.bidder, a.country, a.type, a.main, a.reg, a.region_name, a.cls, a.mu, a.price);
    insert into auction_events (player, kind, main, amount, fee) values (a.seller, 'sold', a.main, a.bid, fee);
    insert into auction_events (player, kind, main, amount)      values (a.bidder, 'won',  a.main, a.bid);
  end if;
  delete from auctions where id = a.id;
end $$;

create or replace function public.auction_settle_due() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from auctions where ends_at <= now() order by ends_at limit 20 for update skip locked loop
    perform public.auction_settle(r.id);
  end loop;
end $$;

-- ---------- Выставить номер на аукцион ----------
create or replace function public.auction_create(p_plate bigint, p_start bigint, p_hours int) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; pl plates%rowtype; new_id bigint; t timestamptz;
  min_ask  constant bigint := 1000;
  max_ask  constant bigint := 100000000000;
  max_lots constant int    := 5;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_start is null or p_start < min_ask or p_start > max_ask then raise exception 'bad price'; end if;
  if p_hours is null or p_hours not in (1, 6, 12, 24) then raise exception 'bad duration'; end if;
  perform public.auction_settle_due();
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if (select count(*) from auctions where seller = p.id) >= max_lots then raise exception 'too many'; end if;
  select * into pl from plates where id = p_plate and owner = p.id for update;
  if not found then raise exception 'bad plate'; end if;

  t := now() + make_interval(hours => p_hours);
  insert into auctions (seller, country, type, main, reg, region_name, cls, mu, price, start_price, ends_at, orig_end)
  values (p.id, pl.country, pl.type, pl.main, pl.reg, pl.region_name, pl.cls, pl.mu, pl.price, p_start, t, t)
  returning id into new_id;
  delete from plates where id = pl.id;
  update players set showcase = array_remove(showcase, pl.id) where id = p.id;
  return new_id;
end $$;

-- ---------- Снять лот (только пока нет ставок) ----------
create or replace function public.auction_cancel(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into a from auctions where id = p_id and seller = auth.uid() for update;
  if not found then raise exception 'gone'; end if;
  if a.ends_at <= now() then perform public.auction_settle(a.id); raise exception 'gone'; end if;
  if a.bids > 0 then raise exception 'has bids'; end if;
  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
  values (a.seller, a.country, a.type, a.main, a.reg, a.region_name, a.cls, a.mu, a.price);
  delete from auctions where id = a.id;
end $$;

-- ---------- Ставка ----------
-- Возвращает {ended:true} (торги закончились, лот закрыт) или {bid, ends_at, balance, extended}.
-- Ошибки: gone, own lot, already top, too low, not enough rub, collection full, bad price.
create or replace function public.auction_bid(p_id bigint, p_amount bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a auctions%rowtype; b players%rowtype; cur int; need bigint; new_end timestamptz; ext boolean := false;
  max_ask   constant bigint := 100000000000;
  step_pct  constant int    := 5;
  min_step  constant bigint := 100;
  snipe_s   constant int    := 120;
  ext_max_s constant int    := 7200;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_amount is null or p_amount < 1 or p_amount > max_ask then raise exception 'bad price'; end if;
  select * into a from auctions where id = p_id for update;
  if not found then raise exception 'gone'; end if;
  if a.ends_at <= now() then perform public.auction_settle(a.id); return jsonb_build_object('ended', true); end if;
  if a.seller = auth.uid() then raise exception 'own lot'; end if;
  if a.bidder = auth.uid() then raise exception 'already top'; end if;

  need := case when a.bid is null then a.start_price
               else a.bid + greatest(ceil(a.bid::numeric * step_pct / 100)::bigint, min_step) end;
  if p_amount < need then raise exception 'too low'; end if;

  -- Блокируем игроков в порядке id (покупатель и прежний лидер), как в market_buy
  perform 1 from players where id in (auth.uid(), coalesce(a.bidder, auth.uid())) order by id for update;
  select * into b from players where id = auth.uid();
  if not found then raise exception 'no player'; end if;
  if b.balance < p_amount then raise exception 'not enough rub'; end if;
  select count(*) into cur from plates where owner = b.id and not in_safe;
  if cur >= b.cap_c then raise exception 'collection full'; end if;

  update players set balance = balance - p_amount where id = b.id;
  if a.bidder is not null then
    update players set balance = balance + a.bid where id = a.bidder;                 -- прежнему лидеру ставка возвращается сразу
    insert into auction_events (player, kind, main, amount) values (a.bidder, 'outbid', a.main, a.bid);
  end if;

  new_end := a.ends_at;
  if a.ends_at - now() < make_interval(secs => snipe_s) then
    new_end := least(now() + make_interval(secs => snipe_s), a.orig_end + make_interval(secs => ext_max_s));
    new_end := greatest(new_end, a.ends_at);
    ext := new_end > a.ends_at;
  end if;
  update auctions set bid = p_amount, bidder = b.id, bids = bids + 1, ends_at = new_end where id = a.id;
  return jsonb_build_object('bid', p_amount, 'ends_at', extract(epoch from new_end), 'balance', b.balance - p_amount, 'extended', ext);
end $$;

-- ---------- Лента аукционов других игроков ----------
-- p_cls: 0..4 или null; p_sort: 'end' (скоро закончатся) | 'new' | 'cheap' | 'dear'; страница 30.
-- cur — текущая цена (ставка или старт), nx — минимальная следующая ставка, me — вы лидируете, t — время сервера (сек).
create or replace function public.auction_browse(p_cls int default null, p_sort text default 'end', p_off int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform public.auction_settle_due();
  return jsonb_build_object('t', extract(epoch from now()), 'lots', (
    select coalesce(jsonb_agg(to_jsonb(x) - 'n' order by x.n), '[]'::jsonb)
    from (
      select row_number() over (
               order by case when p_sort = 'cheap' then coalesce(a.bid, a.start_price) end asc,
                        case when p_sort = 'dear'  then coalesce(a.bid, a.start_price) end desc,
                        case when p_sort = 'new'   then a.id end desc,
                        a.ends_at asc, a.id) as n,
             a.id, a.country, a.type, a.main, a.reg, a.region_name as rn, a.cls, a.price,
             coalesce(a.bid, a.start_price) as cur, a.bids,
             case when a.bid is null then a.start_price
                  else a.bid + greatest(ceil(a.bid::numeric * 5 / 100)::bigint, 100) end as nx,
             (a.bidder = auth.uid()) as me,
             extract(epoch from a.ends_at) as ends,
             coalesce(nullif(pl.nick, ''), 'Игрок') as nick
      from auctions a join players pl on pl.id = a.seller
      where a.seller <> auth.uid() and a.ends_at > now() and (p_cls is null or a.cls = p_cls)
      order by n
      limit 30 offset greatest(coalesce(p_off, 0), 0)
    ) x
  ));
end $$;

-- ---------- Мои лоты, мои ставки, непрочитанные события ----------
create or replace function public.auction_mine() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform public.auction_settle_due();
  return jsonb_build_object(
    't', extract(epoch from now()),
    'lots', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'country', a.country, 'type', a.type, 'main', a.main,
               'reg', a.reg, 'rn', a.region_name, 'cls', a.cls, 'price', a.price, 'start', a.start_price,
               'cur', coalesce(a.bid, a.start_price), 'bids', a.bids, 'ends', extract(epoch from a.ends_at)) order by a.ends_at), '[]'::jsonb)
             from auctions a where a.seller = auth.uid()),
    'bids', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'country', a.country, 'type', a.type, 'main', a.main,
               'reg', a.reg, 'rn', a.region_name, 'cls', a.cls, 'price', a.price, 'cur', a.bid, 'bids', a.bids,
               'ends', extract(epoch from a.ends_at), 'me', true) order by a.ends_at), '[]'::jsonb)
             from auctions a where a.bidder = auth.uid()),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'main', e.main, 'amount', e.amount,
               'fee', e.fee) order by e.id), '[]'::jsonb)
             from auction_events e where e.player = auth.uid() and not e.seen)
  );
end $$;

create or replace function public.auction_ack(p_upto bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  update auction_events set seen = true where player = auth.uid() and id <= p_upto;
  delete from auction_events where player = auth.uid() and seen and created_at < now() - interval '30 days';
end $$;

-- ---------- Сброс прогресса (вызывается из reset_progress): свои лоты снимаются с возвратом ставки лидеру,
-- свои ставки обнуляются (баланс игрока и так сбрасывается) ----------
create or replace function public.auction_reset(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions%rowtype;
begin
  for a in select * from auctions where seller = uid for update loop
    if a.bidder is not null then update players set balance = balance + a.bid where id = a.bidder; end if;
    delete from auctions where id = a.id;
  end loop;
  update auctions set bid = null, bidder = null, bids = greatest(bids - 1, 0) where bidder = uid;
  delete from auction_events where player = uid;
end $$;

-- ---------- Права ----------
revoke execute on function
  public.auction_create(bigint, bigint, int), public.auction_cancel(bigint), public.auction_bid(bigint, bigint),
  public.auction_browse(int, text, int), public.auction_mine(), public.auction_ack(bigint)
from public, anon;
grant execute on function
  public.auction_create(bigint, bigint, int), public.auction_cancel(bigint), public.auction_bid(bigint, bigint),
  public.auction_browse(int, text, int), public.auction_mine(), public.auction_ack(bigint)
to authenticated;
revoke execute on function public.auction_settle(bigint), public.auction_settle_due(), public.auction_reset(uuid)
from public, anon, authenticated;
