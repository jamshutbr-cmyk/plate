-- ============================================================
-- Тройная прокрутка: окна продажи, пасс 24 ч, пакет номеров с решениями
-- Миграция поверх schema.sql. Не запущена на базе: прогнать на тесте.
-- ============================================================

-- Окна продажи (расписание правится данными, не релизом)
create table if not exists public.offers (
  id         bigint generated always as identity primary key,
  kind       text not null default 'triple_pass',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  price_usd  bigint not null default 30,
  check (ends_at > starts_at)
);

create unique index if not exists offers_kind_start on public.offers (kind, starts_at);

-- Расписание окон: каждый понедельник 12:00 МСК, 48 часов. Недостающие окна (текущая и 3 следующие недели)
-- создаются сами при первом обращении, поэтому cron и ручное добавление не нужны. Вернёт ближайшее окно.
create or replace function public.triple_window() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  mon timestamp := date_trunc('week', now() at time zone 'Europe/Moscow') + interval '12 hours';
  s timestamp; i int; o offers%rowtype;
begin
  for i in 0..3 loop
    s := mon + i * interval '7 days';
    insert into offers (kind, starts_at, ends_at)
    values ('triple_pass', s at time zone 'Europe/Moscow', (s + interval '48 hours') at time zone 'Europe/Moscow')
    on conflict (kind, starts_at) do nothing;
  end loop;
  select * into o from offers where kind = 'triple_pass' and ends_at > now() order by starts_at limit 1;
  return jsonb_build_object('starts_at', o.starts_at, 'ends_at', o.ends_at, 'price_usd', o.price_usd);
end $$;

-- Пасс: доступ к тройной прокрутке на 24 часа
create table if not exists public.passes (
  owner       uuid primary key references public.players(id) on delete cascade,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- Пакет номеров, ждущих решения игрока
create table if not exists public.pending_rolls (
  id          bigint generated always as identity primary key,
  owner       uuid not null references public.players(id) on delete cascade,
  batch_id    uuid not null,
  plate       jsonb not null,
  price       bigint not null,
  created_at  timestamptz not null default now()
);
create index if not exists pending_rolls_owner_idx on public.pending_rolls (owner);

alter table public.passes        enable row level security;
alter table public.pending_rolls enable row level security;
alter table public.offers        enable row level security;
drop policy if exists passes_read_own on public.passes;
drop policy if exists pending_read_own on public.pending_rolls;
drop policy if exists offers_read_all on public.offers;
create policy passes_read_own on public.passes for select using (owner = auth.uid());
create policy pending_read_own on public.pending_rolls for select using (owner = auth.uid());
create policy offers_read_all on public.offers for select using (true);

-- ------------------------------------------------------------
-- Покупка пасса (только в окне продажи)
-- ------------------------------------------------------------
create or replace function public.buy_triple_pass(uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o offers%rowtype; p players%rowtype; ps passes%rowtype;
  now_ts timestamptz := now(); exp timestamptz;
begin
  perform public.triple_window();   -- гарантирует, что окна созданы
  select * into o from offers
   where kind = 'triple_pass' and now_ts >= starts_at and now_ts < ends_at
   order by starts_at desc limit 1;
  if not found then raise exception 'no window'; end if;

  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;

  select * into ps from passes where owner = uid for update;
  if found and ps.expires_at > now_ts then raise exception 'pass active'; end if;

  if p.usd < o.price_usd then raise exception 'not enough usd'; end if;

  exp := now_ts + interval '24 hours';
  update players set usd = usd - o.price_usd where id = uid;
  insert into passes (owner, started_at, expires_at) values (uid, now_ts, exp)
    on conflict (owner) do update set started_at = excluded.started_at,
                                      expires_at = excluded.expires_at;
  return jsonb_build_object('expires_at', exp);
end $$;

-- ------------------------------------------------------------
-- Стадия пакета: списание, опыт, статистика, сохранение в pending_rolls
-- pls  — массив номеров из edge function (как pl у commit_plate)
-- ft   — массив массивов признаков (int[]), по одному на номер
-- cost — 3000 * n + доплата за регион (считает сервер)
-- ------------------------------------------------------------
create or replace function public.stage_rolls(uid uuid, pls jsonb, ft jsonb, cost bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; ps passes%rowtype;
  n int := jsonb_array_length(pls);
  bid uuid := gen_random_uuid();
  pl jsonb; fts jsonb; i int := 0;
  c int; ty text; k int; key text;
  xpv int[] := array[5,8,20,100,500];
  usdv int[] := array[0,0,2,10,100];
  nx int; nl int; nu bigint; lvup boolean := false;
  st jsonb; newseen text[] := '{}';
  unlock_cls boolean := false; unlock_type boolean := false;
  unlock text := null;
begin
  if n < 1 or n > 3 then raise exception 'bad count'; end if;

  select * into ps from passes where owner = uid;
  if not found or ps.expires_at <= now() then raise exception 'no pass'; end if;

  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;

  if exists (select 1 from pending_rolls where owner = uid) then
    raise exception 'pending exists';
  end if;
  if p.balance < cost then raise exception 'not enough rub'; end if;

  nx := p.xp; nl := p.lvl; nu := p.usd; st := p.stats;

  for pl in select value from jsonb_array_elements(pls) loop
    i := i + 1;
    c  := (pl->>'cls')::int;
    ty := pl->>'type';

    insert into pending_rolls (owner, batch_id, plate, price)
    values (uid, bid, pl, (pl->>'price')::bigint);

    nx := nx + xpv[c + 1]; nu := nu + usdv[c + 1];
    while nx >= nl * 1250 loop
      nx := nx - nl * 1250; nl := nl + 1; nu := nu + 10 * nl; lvup := true;
    end loop;

    st := jsonb_set(st, '{n}', to_jsonb((st->>'n')::bigint + 1));
    st := jsonb_set(st, '{best}',
      to_jsonb(greatest((st->>'best')::bigint, (pl->>'price')::bigint)));
    st := jsonb_set(st, array['cls', c::text],
      to_jsonb(((st->'cls'->>c)::int) + 1));

    fts := ft->(i - 1);
    for k in select value::int from jsonb_array_elements_text(fts) loop
      st := jsonb_set(st, array['f', k::text],
        to_jsonb(coalesce((st->'f'->>k::text)::int, 0) + 1));
    end loop;

    foreach key in array array['c' || c, 't' || ty] loop
      if not (key = any(p.seen)) and not (key = any(newseen)) then
        newseen := newseen || key;
        if left(key, 1) = 'c' then unlock_cls := true; else unlock_type := true; end if;
      end if;
    end loop;
  end loop;

  if unlock_cls then unlock := 'cls'; elsif unlock_type then unlock := 'type'; end if;

  update players
     set balance = balance - cost, xp = nx, lvl = nl, usd = nu,
         stats = st, seen = seen || newseen
   where id = uid;

  return jsonb_build_object('batch', bid, 'lvup', lvup, 'unlock', unlock);
end $$;

-- ------------------------------------------------------------
-- Решения игрока: keep / safe / sell. Без решения — sell.
-- decisions: [{"id": 12, "act": "keep"}, ...]
-- ------------------------------------------------------------
create or replace function public.resolve_rolls(uid uuid, decisions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype;
  cur_c int; cur_s int; keep_n int; safe_n int; sell_n int; gain bigint;
begin
  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;
  if not exists (select 1 from pending_rolls where owner = uid) then
    raise exception 'no pending';
  end if;

  drop table if exists _pr;
  create temp table _pr on commit drop as
    select pr.id, pr.plate, pr.price, coalesce(dec.act, 'sell') as act
      from pending_rolls pr
      left join jsonb_to_recordset(decisions) as dec(id bigint, act text) on dec.id = pr.id
     where pr.owner = uid;

  if exists (
    select 1 from jsonb_to_recordset(decisions) as d(id bigint, act text)
     where d.act not in ('keep', 'safe', 'sell') or d.id not in (select id from _pr)
  ) then
    raise exception 'bad decision';
  end if;

  select count(*) filter (where act = 'keep'),
         count(*) filter (where act = 'safe'),
         count(*) filter (where act = 'sell'),
         coalesce(sum(price) filter (where act = 'sell'), 0)
    into keep_n, safe_n, sell_n, gain
    from _pr;

  select count(*) into cur_c from plates where owner = uid and not in_safe;
  select count(*) into cur_s from plates where owner = uid and in_safe;
  if cur_c + keep_n > p.cap_c then raise exception 'no room'; end if;
  if cur_s + safe_n > p.cap_s then raise exception 'no safe room'; end if;

  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price, in_safe)
  select uid, plate->>'country', plate->>'type', plate->>'main', plate->>'reg',
         plate->>'rn', (plate->>'cls')::int, plate->'mu', price, act = 'safe'
    from _pr where act in ('keep', 'safe');

  gain := floor(gain * public.sell_pct(uid) / 100);   -- 95 + перк «Торговец», как в sell_plates
  update players set balance = balance + gain where id = uid;
  delete from pending_rolls where owner = uid;

  return jsonb_build_object('kept', keep_n, 'safe', safe_n, 'sold', sell_n, 'gain', gain);
end $$;

-- ------------------------------------------------------------
-- Автоматическое решение: оставить, пока есть место, остальное продать.
-- Вызывается при входе игрока и по расписанию для просроченных (24 ч).
-- ------------------------------------------------------------
create or replace function public.auto_resolve(uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; cur_c int; free_c int; dec jsonb := '[]'::jsonb; r record;
begin
  select * into p from players where id = uid;
  if not found then return null; end if;
  if not exists (select 1 from pending_rolls where owner = uid) then return null; end if;

  select count(*) into cur_c from plates where owner = uid and not in_safe;
  free_c := greatest(p.cap_c - cur_c, 0);

  for r in select id from pending_rolls where owner = uid order by id loop
    if free_c > 0 then
      dec := dec || jsonb_build_object('id', r.id, 'act', 'keep');
      free_c := free_c - 1;
    else
      dec := dec || jsonb_build_object('id', r.id, 'act', 'sell');
    end if;
  end loop;

  return public.resolve_rolls(uid, dec) || jsonb_build_object('auto', true);
end $$;

-- Пакеты старше 24 ч решаются автоматически (вызывать по расписанию, например pg_cron каждые 10 мин)
create or replace function public.auto_resolve_stale() returns int
language plpgsql security definer set search_path = public as $$
declare o uuid; n int := 0;
begin
  for o in select distinct owner from pending_rolls
            where created_at < now() - interval '24 hours' loop
    perform public.auto_resolve(o);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Доступ: функции вызывает только edge function (service_role)
revoke all on function public.triple_window() from public, anon;
grant execute on function public.triple_window() to authenticated, service_role;
revoke all on function public.buy_triple_pass(uuid) from public, anon, authenticated;
revoke all on function public.stage_rolls(uuid, jsonb, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.resolve_rolls(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.auto_resolve(uuid) from public, anon, authenticated;
revoke all on function public.auto_resolve_stale() from public, anon, authenticated;
grant execute on function public.buy_triple_pass(uuid) to service_role;
grant execute on function public.stage_rolls(uuid, jsonb, jsonb, bigint) to service_role;
grant execute on function public.resolve_rolls(uuid, jsonb) to service_role;
grant execute on function public.auto_resolve(uuid) to service_role;
grant execute on function public.auto_resolve_stale() to service_role;
