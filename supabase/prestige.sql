-- Перерождение (престиж): добровольный сброс забега за постоянные бонусы.
-- Выполнять ПОСЛЕДНИМ: после schema.sql, seed_regions.sql, shop.sql (+ shop_v2.sql), cases.sql, market.sql и bank.sql. Можно запускать повторно.
-- Файл переопределяет sell_plates, autosell и reset_progress (чтобы учесть бонус продажи и обнулить престиж), поэтому
-- после него schema.sql / cases.sql / market.sql повторно не запускать.
-- Все цены и лимиты живут ТОЛЬКО здесь (константы в функциях); зеркало для показа: PRESTIGE в js/config.js,
-- сверяет tests/prestige.test.mjs. Клиент ничего не считает: он вызывает функции и показывает результат.
--
-- Правила:
--  * Перерождение доступно с уровня reb_lvl_base + reb_lvl_step * (уже сделанные перерождения): 5, 6, 7...
--  * Награда: lvl / stars_div звёзд (целая часть): уровень 5 даёт 5 звёзд, 6 даёт 6 и т. д.. Звёзды тратятся на постоянные бонусы (perks).
--  * Бонус n-го уровня стоит n звёзд. sell: +1% к цене продажи за уровень (до 100%), cash: +50 000 ₽ к стартовым деньгам,
--    usd: +5 $ к стартовым долларам.
--  * Сбрасывается: номера (и сейф), деньги, $, опыт, уровень, вместимость, автопродажа, вклады, буст удачи, лоты рынка.
--  * Остаётся: статистика, альбом и достижения, машины, купленное в магазине и банке, ежедневный бонус, слоты рынка.

alter table public.players add column if not exists rebirths int not null default 0 check (rebirths >= 0);
alter table public.players add column if not exists stars    int not null default 0 check (stars >= 0);   -- неистраченные звёзды
alter table public.players add column if not exists perks    jsonb not null default '{"sell":0,"cash":0,"usd":0}';

-- Процент, который игра платит за проданный номер: 95 + уровень бонуса sell (не выше 100)
create or replace function public.sell_pct(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select 95 + least(5, coalesce((perks->>'sell')::int, 0)) from players where id = uid;
$$;

-- Продажа: sell_pct% от суммы цен (SELL_PCT + бонус в js/config.js)
create or replace function public.sell_plates(ids bigint[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare gain bigint; pct int := public.sell_pct(auth.uid());
begin
  with del as (
    delete from plates where owner = auth.uid() and id = any(ids) returning price
  )
  select floor(coalesce(sum(price), 0) * pct / 100) into gain from del;
  update players set balance = balance + gain where id = auth.uid();
  return gain;
end $$;

-- Автопродажа: те же правила, что в schema.sql, но с процентом игрока
create or replace function public.autosell() returns json
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; a jsonb; l int; ceil_v bigint; ids bigint[]; t bigint; n int;
  t1 boolean; t2 boolean; sp boolean; cheap boolean; old boolean; pct int;
begin
  select * into p from players where id = auth.uid() for update;
  a := p.autosell; l := coalesce((a->>'lvl')::int, 0);
  if l = 0 or not coalesce((a->>'on')::boolean, true) then return null; end if;
  pct := public.sell_pct(p.id);
  t1 := coalesce((a->>'t1')::boolean, true);  t2 := coalesce((a->>'t2')::boolean, true);
  sp := coalesce((a->>'sp')::boolean, true);  cheap := coalesce((a->>'cheap')::boolean, false);
  old := coalesce((a->>'old')::boolean, false); ceil_v := coalesce((a->>'ceil')::bigint, 0);

  select array_agg(id) into ids from (
    select id from plates
    where owner = p.id and not in_safe
      and (cls = 0 or (cls = 1 and l >= 4 and t1) or (cls = 2 and l >= 8 and t2))
      and (type = 'civil' or (l >= 5 and sp))
      and (not (l >= 3 and ceil_v > 0) or price <= ceil_v)
    order by case when l >= 7 and cheap then price else 0 end,
             case when l >= 2 and old and not (l >= 7 and cheap) then id else 0 end,
             id
    limit case when (l >= 7 and cheap) or (l >= 2 and old) then 1 else 100000 end
  ) q;
  if ids is null then return null; end if;

  with del as (delete from plates where owner = p.id and id = any(ids) returning price)
  select floor(coalesce(sum(price), 0) * pct / 100), count(*) into t, n from del;
  update players set balance = balance + t where id = p.id;
  return json_build_object('n', n, 'gain', t);
end $$;

-- Перерождение. Ответ: { stars (получено), total (на счету), rebirths, need (уровень для следующего) }
create or replace function public.rebirth() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  reb_lvl_base constant int := 5;
  reb_lvl_step constant int := 1;
  stars_div    constant int := 1;
  cash_step    constant bigint := 50000;
  usd_step     constant int := 5;
  p players%rowtype; need int; gain int;
begin
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  need := reb_lvl_base + reb_lvl_step * p.rebirths;
  if p.lvl < need then raise exception 'level too low'; end if;
  if exists (select 1 from market_listings where seller = p.id) then raise exception 'has listings'; end if;
  if exists (select 1 from bank_deposits where owner = p.id) then raise exception 'has deposits'; end if;
  gain := p.lvl / stars_div;

  delete from plates where owner = p.id;
  delete from market_sales where seller = p.id;
  if to_regprocedure('public.bank_reset(uuid)') is not null then execute 'select public.bank_reset($1)' using p.id; end if;
  update players set
    balance = 50000 + cash_step * coalesce((perks->>'cash')::int, 0),
    usd     = usd_step * coalesce((perks->>'usd')::int, 0),
    xp = 0, lvl = 1, cap_c = 100, cap_s = 5,
    autosell = '{"lvl":0,"on":true,"t1":true,"t2":true,"sp":true,"old":false,"cheap":false,"ceil":0,"every":false,"low":false}',
    luck = 0, rebirths = rebirths + 1, stars = stars + gain
  where id = p.id;
  return jsonb_build_object('stars', gain, 'total', p.stars + gain, 'rebirths', p.rebirths + 1,
                            'need', reb_lvl_base + reb_lvl_step * (p.rebirths + 1));
end $$;

-- Покупка бонуса за звёзды: следующий уровень n стоит n звёзд. k: sell (макс 5), cash (макс 10), usd (макс 10)
create or replace function public.buy_perk(k text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; cur int; mx int; cost int;
begin
  mx := case k when 'sell' then 5 when 'cash' then 10 when 'usd' then 10 else null end;
  if mx is null then raise exception 'bad perk'; end if;
  select * into p from players where id = auth.uid() for update;
  cur := coalesce((p.perks->>k)::int, 0);
  if cur >= mx then raise exception 'max'; end if;
  cost := cur + 1;
  if p.stars < cost then raise exception 'not enough stars'; end if;
  update players set stars = stars - cost, perks = jsonb_set(perks, array[k], to_jsonb(cur + 1)) where id = p.id;
  return jsonb_build_object('stars', p.stars - cost, 'level', cur + 1);
end $$;

-- Полный сброс прогресса: как в market.sql, плюс обнуляются перерождения, звёзды и бонусы
create or replace function public.reset_progress() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from plates where owner = auth.uid();
  delete from market_listings where seller = auth.uid();
  delete from market_sales where seller = auth.uid();
  if to_regprocedure('public.bank_reset(uuid)') is not null then execute 'select public.bank_reset($1)' using auth.uid(); end if;
  update players set balance = 50000, usd = 0, xp = 0, lvl = 1, cap_c = 100, cap_s = 5,
    daily_last = null, daily_streak = 0, rescue_last = null, seen = '{}', cars = '{}',
    stats = '{"n":0,"best":0,"cls":[0,0,0,0,0],"f":{}}',
    autosell = '{"lvl":0,"on":true,"t1":true,"t2":true,"sp":true,"old":false,"cheap":false,"ceil":0,"every":false,"low":false}',
    rebirths = 0, stars = 0, perks = '{"sell":0,"cash":0,"usd":0}'
  where id = auth.uid();
end $$;


-- ---------- Рейтинг: к двум видам из leaderboard.sql добавляется 'rebirths' (по числу перерождений) ----------
-- Версия из leaderboard.sql заменяется: после prestige.sql leaderboard.sql повторно не запускать.
-- В каждой строке есть rb (перерождения), чтобы показать их рядом с игроком в любом виде.
create or replace function public.get_leaderboard(p_kind text default 'best') returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind is null or p_kind not in ('best', 'coins', 'rebirths') then raise exception 'bad kind'; end if;
  return (
    with base as (
      select id, nick, lvl, created_at, rebirths as rb,
             (stats->>'best')::bigint as best,
             (stats->>'n')::bigint as total,
             case p_kind when 'coins' then balance when 'rebirths' then rebirths::bigint else (stats->>'best')::bigint end as val
      from players
      where (stats->>'n')::bigint > 0 and (p_kind <> 'rebirths' or rebirths > 0)
    ), ranked as (
      select *, row_number() over (order by val desc, lvl desc, total desc, created_at) as rk from base
    )
    select json_build_object(
      'kind', p_kind,
      'top', coalesce((select json_agg(json_build_object('rk', rk, 'id', id, 'nick', nick, 'lvl', lvl, 'best', best, 'total', total, 'val', val, 'rb', rb, 'me', id = auth.uid()) order by rk)
                       from ranked where rk <= 50), '[]'::json),
      'me',  (select json_build_object('rk', rk, 'id', id, 'nick', nick, 'lvl', lvl, 'best', best, 'total', total, 'val', val, 'rb', rb)
              from ranked where id = auth.uid())
    )
  );
end $$;
revoke execute on function public.get_leaderboard(text) from public, anon;
grant  execute on function public.get_leaderboard(text) to authenticated;

-- ---------- Права ----------
revoke execute on function public.sell_pct(uuid), public.rebirth(), public.buy_perk(text) from public, anon, authenticated;
grant  execute on function public.rebirth(), public.buy_perk(text) to authenticated;
revoke execute on function public.sell_plates(bigint[]), public.autosell(), public.reset_progress() from public, anon;
grant  execute on function public.sell_plates(bigint[]), public.autosell(), public.reset_progress() to authenticated;
