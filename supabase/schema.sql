-- Генератор номеров: схема Supabase
-- Идея: клиент ТОЛЬКО читает свои данные. Любое изменение — через функции ниже
-- (security definer) или Edge Functions с service_role. Прямых INSERT/UPDATE/DELETE у клиента нет.

create table public.players (
  id            uuid primary key references auth.users(id) on delete cascade,
  tg_id         bigint unique not null,
  nick          text not null default '' check (char_length(nick) <= 20),
  balance       bigint not null default 50000 check (balance >= 0),
  usd           int    not null default 0     check (usd >= 0),
  xp            int    not null default 0,
  lvl           int    not null default 1,
  cap_c         int    not null default 100,
  cap_s         int    not null default 5,
  daily_last    timestamptz,
  daily_streak  int    not null default 0,
  rescue_last   timestamptz,
  stats         jsonb  not null default '{"n":0,"best":0,"cls":[0,0,0,0,0],"f":{}}',
  autosell      jsonb  not null default '{"lvl":0,"on":true,"t1":true,"t2":true,"sp":true,"old":false,"cheap":false,"ceil":0,"every":false,"low":false}',
  settings      jsonb  not null default '{"theme":"dark","vol":100,"vib":true,"reel":true,"fx":0,"mute":false,"music":false}',
  country       text   not null default 'RU' check (country in ('RU','BY')),
  reg           text   not null default '',      -- выбранный регион (название) или '' = все
  seen          text[] not null default '{}',    -- открытые редкости/типы: 'c0'..'c4', 'tcivil'...
  created_at    timestamptz not null default now()
);

create table public.plates (
  id           bigint generated always as identity primary key,
  owner        uuid not null references public.players(id) on delete cascade,
  country      text not null check (country in ('RU','BY')),
  type         text not null check (type in ('civil','taxi','police')),
  main         text not null,
  reg          text not null,
  region_name  text not null,
  cls          smallint not null check (cls between 0 and 4),
  mu           jsonb not null,            -- множители: комбо, цифры, регион, код
  price        bigint not null check (price >= 0),
  in_safe      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index plates_owner_idx on public.plates(owner, in_safe);
create index plates_price_idx on public.plates(price desc);

-- RLS: только чтение своего. Записи для клиента нет.
alter table public.players enable row level security;
alter table public.plates  enable row level security;
create policy players_read_own on public.players for select using (id = auth.uid());
create policy plates_read_own  on public.plates  for select using (owner = auth.uid());
revoke insert, update, delete on public.players, public.plates from anon, authenticated;

-- Публичный рейтинг без лишних полей (view выполняется с правами владельца, поэтому RLS его не режет)
create view public.leaderboard as
  select nick, lvl, (stats->>'best')::bigint as best_price, (stats->>'n')::bigint as total
  from public.players
  order by best_price desc
  limit 100;
grant select on public.leaderboard to anon, authenticated;

-- ---------- Действия игрока (аналог api.* в клиенте) ----------

-- Продажа: 95% от суммы цен (SELL_PCT в js/config.js, сверяет tests/market.test.mjs)
create or replace function public.sell_plates(ids bigint[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare gain bigint;
begin
  with del as (
    delete from plates where owner = auth.uid() and id = any(ids) returning price
  )
  select floor(coalesce(sum(price), 0) * 95 / 100) into gain from del;
  update players set balance = balance + gain where id = auth.uid();
  return gain;
end $$;

-- Перенос коллекция <-> сейф с учётом лимитов
create or replace function public.move_plates(ids bigint[], to_safe boolean) returns int
language plpgsql security definer set search_path = public as $$
declare cap int; cur int; free int; n int;
begin
  select case when to_safe then cap_s else cap_c end into cap from players where id = auth.uid() for update;
  select count(*) into cur from plates where owner = auth.uid() and in_safe = to_safe;
  free := greatest(cap - cur, 0);
  with pick as (
    select id from plates
    where owner = auth.uid() and id = any(ids) and in_safe <> to_safe
    order by id limit free
  ), u as (
    update plates set in_safe = to_safe where id in (select id from pick) returning 1
  )
  select count(*) into n from u;
  return n;
end $$;

-- Ежедневный бонус: 3000 * день серии, на 7-й день +5 $
create or replace function public.claim_daily() returns json
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; ds int; r bigint; ub int := 0;
begin
  select * into p from players where id = auth.uid() for update;
  if p.daily_last is not null and now() - p.daily_last < interval '20 hours' then
    return null;
  end if;
  ds := case when p.daily_last is not null and now() - p.daily_last < interval '48 hours'
             then least(7, p.daily_streak + 1) else 1 end;
  r := 3000 * ds;
  if ds = 7 then ub := 5; end if;
  update players set balance = balance + r, usd = usd + ub, daily_last = now(), daily_streak = ds
   where id = p.id;
  return json_build_object('ds', ds, 'bonus', r, 'usd', ub);
end $$;

-- Расширение хранилища: kind = 'c' (коллекция, за ₽) или 's' (сейф, за $)
create or replace function public.buy_capacity(kind text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; i int; cost bigint;
  cst int[] := array[100,150,200,300,500];  cco bigint[] := array[500000,2000000,8000000,25000000];
  sst int[] := array[5,10,20,35,50];        sco bigint[] := array[25,75,150,300];
begin
  select * into p from players where id = auth.uid() for update;
  if kind = 'c' then
    i := array_position(cst, p.cap_c);
    if i is null or i >= array_length(cst, 1) then raise exception 'max'; end if;
    cost := cco[i];
    if p.balance < cost then raise exception 'not enough rub'; end if;
    update players set balance = balance - cost, cap_c = cst[i + 1] where id = p.id;
  elsif kind = 's' then
    i := array_position(sst, p.cap_s);
    if i is null or i >= array_length(sst, 1) then raise exception 'max'; end if;
    cost := sco[i];
    if p.usd < cost then raise exception 'not enough usd'; end if;
    update players set usd = usd - cost, cap_s = sst[i + 1] where id = p.id;
  else
    raise exception 'bad kind';
  end if;
end $$;

-- Смена ника
create or replace function public.set_nick(n text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update players set nick = left(trim(coalesce(n, '')), 20) where id = auth.uid();
  return (select nick from players where id = auth.uid());
end $$;

-- ---------- Регионы (справочник на сервере; генерацию читает Edge Function) ----------
create table public.regions (
  country text not null check (country in ('RU','BY')),
  code    text not null,
  name    text not null,
  mult    numeric not null default 1,
  rich    boolean not null default false,
  primary key (country, code)
);
alter table public.regions enable row level security;
create policy regions_read on public.regions for select using (true);  
revoke insert, update, delete on public.regions from anon, authenticated;
-- данные: supabase/seed_regions.sql

-- ---------- Новые функции ----------

-- Атомарная выдача номера. Вызывает ТОЛЬКО Edge Function generate (service_role): номер уже сгенерирован там.
-- Здесь: проверка лимита и денег, списание 3000, вставка, опыт/уровень/$, статистика, открытия.
create or replace function public.commit_plate(uid uuid, pl jsonb, ft int[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; cost constant bigint := 3000;
  c int := (pl->>'cls')::int; ty text := pl->>'type';
  xpv int[] := array[5,8,20,100,500]; usdv int[] := array[0,0,2,10,100];
  nx int; nl int; nu bigint; lvup boolean := false;
  st jsonb; k int; newseen text[] := '{}'; key text; unlock_cls boolean := false; unlock_type boolean := false;
  row_id bigint; ts timestamptz := now();
begin
  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;
  if (select count(*) from plates where owner = uid and not in_safe) >= p.cap_c then raise exception 'collection full'; end if;
  if p.balance < cost then raise exception 'not enough rub'; end if;

  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
  values (uid, pl->>'country', ty, pl->>'main', pl->>'reg', pl->>'rn', c, pl->'mu', (pl->>'price')::bigint)
  returning id into row_id;

  nx := p.xp + xpv[c + 1]; nl := p.lvl; nu := p.usd + usdv[c + 1];
  while nx >= nl * 1250 loop nx := nx - nl * 1250; nl := nl + 1; nu := nu + 10 * nl; lvup := true; end loop;

  st := p.stats;
  st := jsonb_set(st, '{n}', to_jsonb((st->>'n')::bigint + 1));
  st := jsonb_set(st, '{best}', to_jsonb(greatest((st->>'best')::bigint, (pl->>'price')::bigint)));
  st := jsonb_set(st, array['cls', c::text], to_jsonb(((st->'cls'->>c)::int) + 1));
  foreach k in array ft loop
    st := jsonb_set(st, array['f', k::text], to_jsonb(coalesce((st->'f'->>k::text)::int, 0) + 1));
  end loop;

  foreach key in array array['c' || c, 't' || ty] loop
    if not (key = any(p.seen)) then
      newseen := newseen || key;
      if left(key, 1) = 'c' then unlock_cls := true; else unlock_type := true; end if;
    end if;
  end loop;

  update players set balance = balance - cost, xp = nx, lvl = nl, usd = nu, stats = st, seen = seen || newseen where id = uid;
  return jsonb_build_object('id', row_id, 'ts', (extract(epoch from ts) * 1000)::bigint, 'lvup', lvup,
    'unlock', case when unlock_cls then 'cls' when unlock_type then 'type' else null end);
end $$;

-- Покупка уровня автопродажи (цены как AL в config.js)
create or replace function public.buy_autosell() returns void
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; cost int[] := array[25,50,100,150,200,250,300,400,500]; l int;
begin
  select * into p from players where id = auth.uid() for update;
  l := coalesce((p.autosell->>'lvl')::int, 0);
  if l >= array_length(cost, 1) then raise exception 'max'; end if;
  if p.usd < cost[l + 1] then raise exception 'not enough usd'; end if;
  update players set usd = usd - cost[l + 1], autosell = jsonb_set(autosell, '{lvl}', to_jsonb(l + 1)) where id = p.id;
end $$;

-- Переключатель настройки автопродажи: ceil крутится по кругу, old/cheap взаимоисключающие
create or replace function public.autosell_toggle(k text) returns void
language plpgsql security definer set search_path = public as $$
declare a jsonb; ceils int[] := array[0,500,5000,50000,500000]; cur int; v boolean;
begin
  if k not in ('on','old','ceil','t1','sp','every','cheap','t2','low') then raise exception 'bad key'; end if;
  select autosell into a from players where id = auth.uid() for update;
  if k = 'ceil' then
    cur := coalesce(array_position(ceils, (a->>'ceil')::int), 1);
    a := jsonb_set(a, '{ceil}', to_jsonb(ceils[(cur % array_length(ceils, 1)) + 1]));
  else
    v := not coalesce((a->>k)::boolean, false);
    a := jsonb_set(a, array[k], to_jsonb(v));
    if v and k = 'old'   then a := jsonb_set(a, '{cheap}', 'false'); end if;
    if v and k = 'cheap' then a := jsonb_set(a, '{old}', 'false'); end if;
  end if;
  update players set autosell = a where id = auth.uid();
end $$;

-- Автопродажа: те же правила, что в api.autosell() на клиенте
create or replace function public.autosell() returns json
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; a jsonb; l int; ceil_v bigint; ids bigint[]; t bigint; n int;
  t1 boolean; t2 boolean; sp boolean; cheap boolean; old boolean;
begin
  select * into p from players where id = auth.uid() for update;
  a := p.autosell; l := coalesce((a->>'lvl')::int, 0);
  if l = 0 or not coalesce((a->>'on')::boolean, true) then return null; end if;
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
  select floor(coalesce(sum(price), 0) * 95 / 100), count(*) into t, n from del;
  update players set balance = balance + t where id = p.id;
  return json_build_object('n', n, 'gain', t);
end $$;

-- Помощь при банкротстве: ровно на одну генерацию, не чаще раза в 30 минут
create or replace function public.bailout() returns boolean
language plpgsql security definer set search_path = public as $$
declare p players%rowtype;
begin
  select * into p from players where id = auth.uid() for update;
  if p.balance < 3000
     and not exists (select 1 from plates where owner = p.id)
     and (p.rescue_last is null or now() - p.rescue_last >= interval '30 minutes') then
    update players set balance = 3000, rescue_last = now() where id = p.id;
    return true;
  end if;
  return false;
end $$;

-- Настройки генерации (страна/регион влияют на цену, поэтому лежат на сервере)
create or replace function public.set_gen_prefs(c text, r text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if c not in ('RU','BY') then raise exception 'bad country'; end if;
  if coalesce(r, '') <> '' and not exists (select 1 from regions where country = c and name = r) then
    r := '';
  end if;
  update players set country = c, reg = coalesce(r, '') where id = auth.uid();
end $$;

-- Настройки интерфейса (тема, звук и т.п.): белый список ключей, значения проверяются по типу
create or replace function public.set_settings(s jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur jsonb; k text;
begin
  select settings into cur from players where id = auth.uid() for update;
  for k in select jsonb_object_keys(s) loop
    if k in ('vib','reel','mute','music') then
      if jsonb_typeof(s->k) = 'boolean' then cur := jsonb_set(cur, array[k], s->k); end if;
    elsif k in ('vol','fx') then
      if jsonb_typeof(s->k) = 'number' then
        if (k = 'vol' and (s->>k)::numeric between 0 and 100) or (k = 'fx' and (s->>k)::numeric in (0,1,2)) then
          cur := jsonb_set(cur, array[k], s->k);
        end if;
      end if;
    elsif k = 'theme' then
      if (s->>k) in ('dark','gold','light','pink','silver') then cur := jsonb_set(cur, array[k], s->k); end if;
    end if;
  end loop;
  update players set settings = cur where id = auth.uid();
  return cur;
end $$;

-- Полный сброс прогресса
create or replace function public.reset_progress() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from plates where owner = auth.uid();
  update players set balance = 50000, usd = 0, xp = 0, lvl = 1, cap_c = 100, cap_s = 5,
    daily_last = null, daily_streak = 0, rescue_last = null, seen = '{}',
    stats = '{"n":0,"best":0,"cls":[0,0,0,0,0],"f":{}}',
    autosell = '{"lvl":0,"on":true,"t1":true,"t2":true,"sp":true,"old":false,"cheap":false,"ceil":0,"every":false,"low":false}'
  where id = auth.uid();
end $$;

-- ---------- Права ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.sell_plates(bigint[]), public.move_plates(bigint[], boolean), public.claim_daily(),
  public.buy_capacity(text), public.set_nick(text), public.buy_autosell(), public.autosell_toggle(text),
  public.autosell(), public.bailout(), public.set_gen_prefs(text, text), public.set_settings(jsonb),
  public.reset_progress()
to authenticated;
-- commit_plate НЕ выдаётся клиентам: её зовёт только Edge Function generate с service_role.
grant execute on function public.commit_plate(uuid, jsonb, int[]) to service_role;

-- Альбом регионов (триггер): см. album.sql
-- Альбом регионов: при появлении номера (выпал, обмен) у игрока запоминается ключ 'r:СТРАНА:КОД' в players.seen.
-- Ничего не заменяет: commit_plate и остальные функции остаются как есть. Можно выполнять повторно.
create or replace function public.track_region_seen() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text := 'r:' || new.country || ':' || new.reg;
begin
  update players set seen = seen || k where id = new.owner and not (k = any(seen));
  return new;
end $$;

drop trigger if exists plates_region_seen on public.plates;
create trigger plates_region_seen after insert or update of owner on public.plates
  for each row execute function public.track_region_seen();

-- Один раз: открыть регионы по номерам, которые у игроков уже есть (проданные ранее вернуть нельзя)
update public.players p set seen = (select array(select distinct unnest(p.seen || r.keys)))
from (select owner, array_agg(distinct 'r:' || country || ':' || reg) as keys from public.plates group by owner) r
where r.owner = p.id;
