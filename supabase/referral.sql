-- Реферальная система «Друзья» (ТЗ «реферальная система и медиа-программа», часть A, v1.0).
-- Выполнять в SQL Editor ПОСЛЕ schema.sql, shop.sql, cases.sql, market.sql, bank.sql, auction.sql, bans.sql. Безопасно повторять.
-- Следом (если нужна медиа-программа) выполнить media.sql: он использует функции ref_grant, ref_cfg_get и т. д. из этого файла.
--
-- Принципы (раздел 2 ТЗ): сервер решает всё; награда идемпотентна по ключу (player, key); награды идут через удержание (hold);
-- любой платёж и отзыв пишется в ref_ledger; константы лежат в таблицах (ref_stages, ref_ladder, ref_cfg), а не в функциях.
-- Клиентские зеркала констант: блок REF в js/config.js, их сверяет tests/referral.test.mjs.
--
-- Что нужно проверить до запуска на живой базе (в zip не было event.sql, clans.sql, promo.sql, trades):
--   1) ref_stage3_ok(): имена таблиц ивента (ev_runs) и кланов (clan_members). Обёрнуто в begin/exception, при несовпадении условие просто ложно.
--   2) ref_pair_flow(): использует market_sales (seller, buyer_nick, ask, created_at). Если у вас есть таблица обменов, добавьте её суммы.
--   3) staff_level(): сейчас читает свою таблицу staff_roles. Если у вас уже есть таблица штаба из promo.sql, замените тело функции.
--   4) Донатный процент (ref_donate_hook) вызывает вебхук оплаты; по умолчанию выключен (ref_cfg.donate_on = false).

-- ---------- Колонки игрока ----------
alter table public.players
  add column if not exists ref_code     text,
  add column if not exists ref_by       uuid references public.players(id) on delete set null,
  add column if not exists ref_bound_at timestamptz,
  add column if not exists ref_debt     bigint not null default 0 check (ref_debt >= 0),
  add column if not exists can_dm       boolean not null default false;
create unique index if not exists players_ref_code_key on public.players (ref_code) where ref_code is not null;

-- ---------- Штаб (роли) ----------
-- 1 стажёр, 2 модератор, 3 старший модератор, 4 админ, 5 главный админ. Клиенту таблица недоступна.
create table if not exists public.staff_roles (
  tg_id      bigint primary key,
  role       text not null check (role in ('trainee', 'moderator', 'senior', 'admin', 'chief')),
  created_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon, authenticated;
create or replace function public.staff_level(p_tg bigint) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case role when 'trainee' then 1 when 'moderator' then 2 when 'senior' then 3 when 'admin' then 4 when 'chief' then 5 end
                   from staff_roles where tg_id = p_tg), 0)
$$;
revoke execute on function public.staff_level(bigint) from public, anon, authenticated;
grant execute on function public.staff_level(bigint) to service_role;

-- ---------- Таблицы ----------
create table if not exists public.ref_stages (
  code  smallint primary key,
  title text not null,
  rule  jsonb not null
);
-- Пороги этапов (зеркало: REF.stages в config.js). 0: пришёл, 1: освоился, 2: играет (активный реферал), 3: свой.
insert into public.ref_stages (code, title, rule) values
  (0, 'Пришёл',    '{}'),
  (1, 'Освоился',  '{"rolls": 30}'),
  (2, 'Играет',    '{"rolls": 100, "days": 3, "window": 10}'),
  (3, 'Свой',      '{"age_days": 14}')
on conflict (code) do update set title = excluded.title, rule = excluded.rule;

create table if not exists public.referrals (
  referee  uuid primary key references public.players(id) on delete cascade,
  referrer uuid not null references public.players(id) on delete cascade,
  bound_at timestamptz not null default now(),
  stage    smallint not null default 0,
  stage_at jsonb not null default '{}',
  rolls    int not null default 0,            -- максимум прокруток, который мы видели (не падает после перерождения)
  status   text not null default 'pending' check (status in ('pending', 'active', 'review', 'revoked')),
  flags    text[] not null default '{}',      -- speed | ring | cluster | limit | block
  revoked_at timestamptz,
  check (referee <> referrer)
);
alter table public.referrals add column if not exists revoked_at timestamptz;
create index if not exists referrals_referrer_idx on public.referrals (referrer, status);

create table if not exists public.ref_ledger (
  id         bigserial primary key,
  player     uuid not null references public.players(id) on delete cascade,
  referee    uuid,
  kind       text not null check (kind in ('welcome', 'stage1', 'stage2', 'stage3', 'ladder', 'donate', 'week', 'revoke')),
  key        text not null,                    -- например stage2:<referee>, ladder:25: идемпотентность
  reward     jsonb not null,                   -- {rub, luck, items[], car, plate}
  status     text not null default 'hold' check (status in ('hold', 'paid', 'review', 'cancelled')),
  release_at timestamptz,
  paid_at    timestamptz,
  note       text not null default '',
  notified   boolean not null default false,   -- штабу уже отправлено (для статуса review)
  created_at timestamptz not null default now(),
  unique (player, key)
);
create index if not exists ref_ledger_due_idx on public.ref_ledger (status, release_at);
create index if not exists ref_ledger_player_idx on public.ref_ledger (player, created_at desc);

create table if not exists public.ref_ladder (n int primary key, reward jsonb not null, title text);
create table if not exists public.ref_claims (player uuid references public.players(id) on delete cascade, n int, at timestamptz default now(), primary key (player, n));
create table if not exists public.ref_boosts (id serial primary key, starts_at timestamptz not null, ends_at timestamptz not null, mult numeric(3,1) not null check (mult >= 1 and mult <= 5));
create table if not exists public.ref_cfg (key text primary key, val jsonb not null);
create table if not exists public.player_days (player uuid references public.players(id) on delete cascade, day date, primary key (player, day));
create table if not exists public.ref_sub_check (player uuid primary key references public.players(id) on delete cascade, ok boolean not null, at timestamptz not null default now());
create table if not exists public.ref_outbox (id bigserial primary key, tg_id bigint not null, kind text not null, body text not null, created_at timestamptz not null default now(), sent_at timestamptz);
create table if not exists public.ref_alerts (id bigserial primary key, player uuid, kind text not null, data jsonb not null default '{}', created_at timestamptz not null default now(), notified boolean not null default false);
create table if not exists public.ref_audit (id bigserial primary key, who bigint, what text not null, ref text, at timestamptz not null default now(), data jsonb not null default '{}');

do $$
declare t text;
begin
  foreach t in array array['ref_stages', 'referrals', 'ref_ledger', 'ref_ladder', 'ref_claims', 'ref_boosts', 'ref_cfg', 'player_days', 'ref_sub_check', 'ref_outbox', 'ref_alerts', 'ref_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Лестница (зеркало REF.ladder). items: id косметики; car: 'rich' (пул дорогих машин); plate: серия «Друзья» (rare = редкая комбинация)
insert into public.ref_ladder (n, reward, title) values
  (1,   '{"rub": 1000000, "luck": 20}', null),
  (3,   '{"items": ["ref_f_own"], "luck": 30}', 'Свой человек'),
  (5,   '{"rub": 5000000, "luck": 50}', null),
  (10,  '{"items": ["ref_t_recruiter"], "luck": 100}', 'Вербовщик'),
  (25,  '{"rub": 10000000, "plate": "friends"}', 'Номер серии «Друзья»'),
  (50,  '{"rub": 50000000, "luck": 200, "items": ["ref_d_column"]}', 'Колонна'),
  (100, '{"rub": 100000000, "plate": "friends", "rare": true, "items": ["ref_t_leader"]}', 'Лидер сети'),
  (250, '{"rub": 250000000, "plate": "friends", "rare": true}', 'Редкий номер серии и 250 млн'),
  (500, '{"named": true}', 'Именной номер по заявке')
on conflict (n) do update set reward = excluded.reward, title = excluded.title;

-- Параметры (меняет только админ через ref_cfg_set; зеркало показа: REF в config.js)
insert into public.ref_cfg (key, val) values
  ('enabled',        'true'),
  ('welcome',        '{"rub": 500000, "luck": 30, "items": ["ref_t_invited"]}'),
  ('rew_stage1',     '{"rub": 200000, "luck": 10}'),
  ('rew_stage2',     '{"rub": 1000000, "luck": 30}'),
  ('rew_stage2_ref', '{"rub": 1500000}'),
  ('rew_stage3',     '{"rub": 2000000, "luck": 50}'),
  ('hold_h',         '{"stage1": 24, "stage2": 72, "stage3": 72, "ladder": 72, "donate": 168}'),
  ('day_budget_rub', '2000000000'),     -- суммарный потолок наград рефералки в сутки (по Москве), ₽; подберите по доходу игроков (balance-sim)
  ('player_cap_rub', '30000000'),       -- потолок одному пригласившему за 24 часа
  ('bind_day_limit', '30'),
  ('act_day_limit',  '15'),
  ('speed_hours',    '6'),
  ('ring_rub',       '10000000'),
  ('ring_days',      '14'),
  ('cluster_n',      '5'),
  ('revoke_days',    '30'),
  ('revoke_regex',   '"(мульти|накрут|мошен|ферм|multi|fraud|cheat|bot)"'),
  ('ban_alert_n',    '3'),
  ('sub_check',      '"on"'),         -- on: перед выдачей нужна свежая проверка подписки (функция ref-cron); off: не проверять
  ('donate_on',      'false'),
  ('donate_pct',     '3'),
  ('donate_days',    '60'),
  ('stars_rub',      '1000'),         -- сколько ₽ считаем за 1 ⭐ при донатном проценте
  ('clan_bonus_on',  'false'),
  ('week_prizes',    '[{"rub": 20000000, "luck": 100, "plate": "friends", "rare": true}, {"rub": 10000000, "luck": 50}, {"rub": 5000000, "luck": 25}]'),
  ('season_start',   '"2026-10-01T00:00:00Z"'),
  ('link_base',      '""')            -- https://t.me/<бот>/<приложение>?startapp=r_  (пусто: клиент соберёт сам из env)
on conflict (key) do nothing;

-- ---------- Косметика рефералки: строки в shop_items нужны, чтобы работал equip_item (цена недостижима, как у банковских титулов) ----------
insert into public.shop_items (id, slot, price) values
  ('ref_t_invited',   'title', 1000000000000000),
  ('ref_t_recruiter', 'title', 1000000000000000),
  ('ref_t_leader',    'title', 1000000000000000),
  ('ref_f_own',       'skin',  1000000000000000),
  ('ref_d_column',    'drop',  1000000000000000)
on conflict (id) do nothing;

-- ---------- Хелперы ----------
create or replace function public.ref_cfg_get(k text) returns jsonb language sql stable set search_path = public as $$ select val from ref_cfg where key = k $$;
create or replace function public.ref_num(k text, d numeric default 0) returns numeric language sql stable set search_path = public as $$
  select coalesce((select (val #>> '{}')::numeric from ref_cfg where key = k), d) $$;
create or replace function public.ref_msk_day() returns date language sql stable as $$ select (now() at time zone 'Europe/Moscow')::date $$;
create or replace function public.ref_msk_start() returns timestamptz language sql stable as $$ select date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow' $$;
create or replace function public.ref_banned(p players) returns boolean language sql immutable as $$ select p.banned_until is not null and p.banned_until > now() $$;

-- Код: 8 символов из A–Z без похожих (нет I, L, O) и цифр 2–9. Зеркало: REF.alphabet в config.js.
create or replace function public.ref_gen_code() returns text language plpgsql as $$
declare a constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; s text; i int;
begin
  loop
    s := '';
    for i in 1..8 loop s := s || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.players where ref_code = s);
  end loop;
  return s;
end $$;
create or replace function public.players_ref_code_trg() returns trigger language plpgsql as $$
begin
  if new.ref_code is null then new.ref_code := public.ref_gen_code(); end if;
  return new;
end $$;
drop trigger if exists players_ref_code on public.players;
create trigger players_ref_code before insert on public.players for each row execute function public.players_ref_code_trg();
-- Старым игрокам код выдаём один раз
do $$ declare r record; begin
  for r in select id from public.players where ref_code is null loop update public.players set ref_code = public.ref_gen_code() where id = r.id; end loop;
end $$;

-- Очередь уведомлений боту: пишем, только если игрок разрешил писать (can_dm). Отправляет функция ref-cron.
create or replace function public.ref_notify(p_player uuid, p_kind text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare t bigint;
begin
  select tg_id into t from players where id = p_player and can_dm;
  if t is not null then insert into ref_outbox (tg_id, kind, body) values (t, p_kind, p_text); end if;
end $$;

create or replace function public.ref_boost_mult() returns numeric language sql stable set search_path = public as $$
  select coalesce((select max(mult) from ref_boosts where now() between starts_at and ends_at), 1) $$;

-- Умножение денежной и «удачной» частей награды на множитель «Недели друзей»
create or replace function public.ref_scale(r jsonb, m numeric) returns jsonb language sql immutable as $$
  select case when m = 1 then r else r
    || case when r ? 'rub'  then jsonb_build_object('rub',  floor((r->>'rub')::numeric  * m)::bigint) else '{}'::jsonb end
    || case when r ? 'luck' then jsonb_build_object('luck', floor((r->>'luck')::numeric * m)::int)    else '{}'::jsonb end end $$;

-- Запись в журнал. Повторный вызов с тем же ключом ничего не меняет (идемпотентность).
create or replace function public.ref_add_ledger(p_player uuid, p_referee uuid, p_kind text, p_key text, p_reward jsonb, p_hold_h numeric, p_review boolean default false, p_scale boolean default true)
returns bigint language plpgsql security definer set search_path = public as $$
declare id bigint;
begin
  insert into ref_ledger (player, referee, kind, key, reward, status, release_at)
  values (p_player, p_referee, p_kind, p_key, case when p_scale then ref_scale(p_reward, ref_boost_mult()) else p_reward end,
          case when p_review then 'review' else 'hold' end, now() + make_interval(secs => (p_hold_h * 3600)::int))
  on conflict (player, key) do nothing returning ref_ledger.id into id;
  return id;
end $$;

-- ---------- Выдача награды (внутренняя; только из SQL-функций) ----------
-- reward: {rub, luck, items[], car: 'rich', plate: 'friends', rare: bool, named: true}
create or replace function public.ref_pick_car(p_uid uuid, p_min smallint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; refund bigint := 0; mine text[];
begin
  select coalesce(cars, '{}') into mine from players where id = p_uid;
  select d.id into c from car_defs d where d.r >= p_min and not (d.id = any(mine)) order by random() limit 1;
  if c is null then
    -- все дорогие машины уже есть: заменяем рублями по стоимости класса p_min
    select val into refund from car_classes where r = p_min;
    return jsonb_build_object('car', null, 'refund', coalesce(refund, 0));
  end if;
  update players set cars = cars || c where id = p_uid;
  return jsonb_build_object('car', c, 'refund', 0);
end $$;

create or replace function public.ref_grant(p_uid uuid, p_reward jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rub bigint := coalesce((p_reward->>'rub')::bigint, 0); lk int := coalesce((p_reward->>'luck')::int, 0); it text; car jsonb; pl jsonb; cap constant int := 5000;
begin
  if p_reward ? 'car' then
    car := ref_pick_car(p_uid, 3);
    rub := rub + coalesce((car->>'refund')::bigint, 0);
  end if;
  if p_reward ? 'plate' then
    pl := series_issue(p_uid, coalesce(p_reward->>'plate', 'friends'), coalesce((p_reward->>'rare')::boolean, false));
    if pl is null then rub := rub + 5000000; end if;      -- серия распродана: компенсация рублями
  end if;
  if rub > 0 then update players set balance = balance + rub where id = p_uid; end if;
  if lk > 0 then update players set luck = least(luck + lk, cap) where id = p_uid; end if;
  if p_reward ? 'items' then
    for it in select jsonb_array_elements_text(p_reward->'items') loop
      update players set owned = owned || it where id = p_uid and not (it = any(owned));
    end loop;
  end if;
  return jsonb_build_object('rub', rub, 'luck', lk, 'car', car->>'car', 'plate', pl);
end $$;

-- Выпуск номера серии (friends | media). Реализация общая для обеих программ; таблица серий и тираж создаются здесь, медиа-серии наполняет media.sql.
create table if not exists public.plate_series (
  series text primary key,                       -- три буквы: первая и две последние в номере
  kind   text not null check (kind in ('friends', 'media')),
  cap    int not null check (cap > 0),
  issued int not null default 0 check (issued >= 0),
  rare_only boolean not null default false,       -- закрытая серия (видна только уровню «Топ-медиа»)
  check (issued <= cap)
);
alter table public.plate_series enable row level security;
drop policy if exists plate_series_read on public.plate_series;
create policy plate_series_read on public.plate_series for select using (true);
revoke insert, update, delete on public.plate_series from anon, authenticated;
create table if not exists public.series_plates (
  series text not null references public.plate_series(series),
  digits text not null check (digits ~ '^[0-9]{3}$'),
  reg    text not null,
  owner  uuid references public.players(id) on delete set null,
  at     timestamptz not null default now(),
  primary key (series, digits, reg)               -- комбинация выпускается один раз на весь проект
);
alter table public.series_plates enable row level security;
revoke all on public.series_plates from anon, authenticated;
insert into public.plate_series (series, kind, cap) values ('СЕМ', 'friends', 300), ('ТОМ', 'friends', 300), ('КУМ', 'friends', 300) on conflict (series) do nothing;   -- проверить пересечения с named.js / engine.js

-- Тип номера: друзья и медиа не выпадают из прокруток (вес 0). Расширяем check у plates, market_listings и auctions.
do $$
declare t text; c record;
begin
  foreach t in array array['plates', 'market_listings', 'auctions'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for c in select conname from pg_constraint where conrelid = ('public.' || t)::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~ '\mtype\M' and pg_get_constraintdef(oid) ~ 'civil' loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_type_check');
    execute format($f$alter table public.%I add constraint %I
      check (type in ('civil','taxi','police','transit','military','diplomat','retro','blat','media','friends'))$f$, t, t || '_type_check');
  end loop;
end $$;

-- p_kind: 'friends' | 'media'. Случайная свободная комбинация; p_rare: цифры 777/001/999 или «ровные» (111–999). Возвращает номер или null, если тираж исчерпан.
create or replace function public.series_pick(p_kind text, p_uid uuid, p_rare boolean, p_series text default null, p_digits text default null, p_reg text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s plate_series%rowtype; d text; r text; tries int := 0; main text; rn text; price constant bigint := 5000000;
  regs text[] := array['77', '99', '177', '777', '78', '178', '97', '50', '52', '54', '61', '63', '66', '74', '16', '02', '23', '24', '36', '38'];
  rare_d text[] := array['777', '001', '999', '111', '222', '333', '444', '555', '666', '888'];
begin
  if p_series is not null then select * into s from plate_series where series = p_series and kind = p_kind for update;
  else select * into s from plate_series where kind = p_kind and not rare_only and issued < cap order by random() limit 1 for update; end if;
  if not found or s.issued >= s.cap then return null; end if;
  loop
    tries := tries + 1; exit when tries > 60;
    d := coalesce(p_digits, case when p_rare then rare_d[1 + floor(random() * array_length(rare_d, 1))::int] else lpad(floor(random() * 999 + 1)::int::text, 3, '0') end);
    r := coalesce(p_reg, regs[1 + floor(random() * array_length(regs, 1))::int]);
    begin
      insert into series_plates (series, digits, reg, owner) values (s.series, d, r, p_uid);
      select name into rn from regions where country = 'RU' and code = r;
      if rn is null then rn := r; end if;
      update plate_series set issued = issued + 1 where series = s.series;
      main := substr(s.series, 1, 1) || d || substr(s.series, 2, 2);
      return jsonb_build_object('series', s.series, 'main', main, 'reg', r, 'rn', rn, 'type', case when p_kind = 'media' then 'media' else 'friends' end, 'price', price);
    exception when unique_violation then
      if p_digits is not null and p_reg is not null then return null; end if;   -- конкретная комбинация занята
    end;
  end loop;
  return null;
end $$;

create or replace function public.series_issue(p_uid uuid, p_kind text, p_rare boolean default false, p_series text default null, p_digits text default null, p_reg text default null, p_price bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb;
begin
  x := series_pick(p_kind, p_uid, p_rare, p_series, p_digits, p_reg);
  if x is null then return null; end if;
  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
  values (p_uid, 'RU', x->>'type', x->>'main', x->>'reg', x->>'rn', 4, jsonb_build_array(1, 1, 1, 150), coalesce(p_price, (x->>'price')::bigint));
  return x;
end $$;
revoke execute on function public.ref_pick_car(uuid, smallint), public.ref_grant(uuid, jsonb), public.series_pick(text, uuid, boolean, text, text, text),
  public.series_issue(uuid, text, boolean, text, text, text, bigint), public.ref_add_ledger(uuid, uuid, text, text, jsonb, numeric, boolean, boolean),
  public.ref_notify(uuid, text, text) from public, anon, authenticated;

-- ---------- Привязка (A1) ----------
-- Ядро. p_manual = true: игрок вводит код сам (в течение 24 часов, пока не пройден этап 1). Для нового игрока из tg-auth p_manual = false.
create or replace function public.ref_bind_core(p_uid uuid, p_code text, p_manual boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me players%rowtype; r players%rowtype; cur uuid; i int := 0; n_today int; flg text[] := '{}'; s1 int := coalesce((select (rule->>'rolls')::int from ref_stages where code = 1), 30);
begin
  select * into me from players where id = p_uid for update;
  if not found then return jsonb_build_object('err', 'code'); end if;
  if me.ref_by is not null or exists (select 1 from referrals where referee = me.id) then return jsonb_build_object('err', 'already'); end if;
  if ref_banned(me) then return jsonb_build_object('err', 'banned'); end if;
  select * into r from players where ref_code = upper(trim(coalesce(p_code, '')));
  if not found or not coalesce((ref_cfg_get('enabled') #>> '{}')::boolean, true) then return jsonb_build_object('err', 'code'); end if;
  if r.id = me.id then return jsonb_build_object('err', 'self'); end if;
  if ref_banned(r) then return jsonb_build_object('err', 'banned'); end if;
  if p_manual and (now() - me.created_at > interval '24 hours' or coalesce((me.stats->>'n')::int, 0) >= s1) then return jsonb_build_object('err', 'late'); end if;
  cur := r.ref_by;                                                      -- A→B→A и более длинные циклы
  while cur is not null and i < 50 loop
    if cur = me.id then return jsonb_build_object('err', 'cycle'); end if;
    select ref_by into cur from players where id = cur; i := i + 1;
  end loop;
  if exists (select 1 from referrals where referrer = me.id) then return jsonb_build_object('err', 'cycle'); end if;   -- у игрока уже есть свои рефералы: привязка запрещена
  select count(*) into n_today from referrals where referrer = r.id and (bound_at at time zone 'Europe/Moscow')::date = ref_msk_day();
  if n_today >= ref_num('bind_day_limit', 30) then flg := array['limit']; end if;
  insert into referrals (referee, referrer, flags) values (me.id, r.id, flg);
  update players set ref_by = r.id, ref_bound_at = now() where id = me.id;
  -- Стартовый набор приглашённому (этап 0): создаём запись и выдаём сразу (release_at = сейчас)
  perform ref_add_ledger(me.id, me.id, 'welcome', 'welcome', ref_cfg_get('welcome'), 0, false);
  perform ref_release_for(me.id);
  perform ref_notify(r.id, 'ref0', 'Ваш друг ' || coalesce(nullif(me.nick, ''), 'новый игрок') || ' зашёл в игру. Награда придёт, когда он освоится.');
  perform ref_notify(me.id, 'welcome', 'Вы получили стартовый набор.');
  return jsonb_build_object('ok', true, 'referrer', coalesce(nullif(r.nick, ''), 'Игрок'));
end $$;

-- Для tg-auth (service_role): привязка нового игрока по start_param
create or replace function public.ref_bind_new(p_uid uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin return ref_bind_core(p_uid, p_code, false); end $$;
-- Ручной ввод кода игроком
create or replace function public.ref_bind(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  return ref_bind_core(auth.uid(), p_code, true);
end $$;
revoke execute on function public.ref_bind_core(uuid, text, boolean), public.ref_bind_new(uuid, text) from public, anon, authenticated;
grant execute on function public.ref_bind_new(uuid, text) to service_role;
revoke execute on function public.ref_bind(text) from public, anon;
grant execute on function public.ref_bind(text) to authenticated;

-- ---------- Дни активности ----------
create or replace function public.ref_touch() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  insert into player_days (player, day) values (auth.uid(), ref_msk_day()) on conflict do nothing;
end $$;

-- ---------- Условия этапов ----------
-- Подписка: null = нет свежей проверки (старше 3 суток или не было), true/false = результат getChatMember (ref-cron)
create or replace function public.ref_sub_ok(p_uid uuid) returns boolean language sql stable set search_path = public as $$
  select case when ref_cfg_get('sub_check') #>> '{}' = 'off' then true
              else (select ok from ref_sub_check where player = p_uid and at > now() - interval '3 days') end $$;

-- Сделки между двумя игроками за период (рынок: по нику покупателя; если у вас есть таблица обменов, прибавьте её суммы здесь)
create or replace function public.ref_pair_flow(a uuid, b uuid, since timestamptz) returns bigint
language plpgsql security definer set search_path = public as $$
declare na text; nb text; s bigint := 0;
begin
  select nick into na from players where id = a; select nick into nb from players where id = b;
  begin
    select coalesce(sum(ask), 0) into s from market_sales m
     where m.created_at >= since and ((m.seller = a and m.buyer_nick = nb) or (m.seller = b and m.buyer_nick = na));
  exception when others then s := 0; end;
  return s;
end $$;

-- Этап 3: заезд в ивенте, сделка не с пригласившим или вступление в клан. Таблицы ивента и кланов в zip не было: имена проверить.
create or replace function public.ref_stage3_ok(e uuid, a uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean := false; an text;
begin
  select nick into an from players where id = a;
  begin execute 'select exists(select 1 from public.ev_runs where player = $1)' into ok using e; exception when others then ok := false; end;
  if ok then return true; end if;
  begin execute 'select exists(select 1 from public.clan_members where player = $1)' into ok using e; exception when others then ok := false; end;
  if ok then return true; end if;
  begin
    select exists(select 1 from market_sales where seller = e and buyer_nick is distinct from an) into ok;
  exception when others then ok := false; end;
  if ok then return true; end if;
  begin
    select exists(select 1 from auctions where (seller = e and bids > 0 and bidder is distinct from a) or (bidder = e and seller is distinct from a)) into ok;
  exception when others then ok := false; end;
  return coalesce(ok, false);
end $$;

-- Лестница: считаем активных рефералов (этап 2+, не забанены, не отозваны) и заводим записи на пройденные ступени
create or replace function public.ref_active_count(p_uid uuid) returns int language sql stable set search_path = public as $$
  select count(*)::int from referrals r join players e on e.id = r.referee
   where r.referrer = p_uid and r.stage >= 2 and r.status in ('active', 'review') and not (e.banned_until is not null and e.banned_until > now()) $$;

create or replace function public.ref_ladder_check(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c int := ref_active_count(p_uid); l record; h numeric := coalesce((ref_cfg_get('hold_h')->>'ladder')::numeric, 72);
begin
  for l in select n, reward from ref_ladder where n <= c order by n loop
    perform ref_add_ledger(p_uid, null, 'ladder', 'ladder:' || l.n, l.reward, h, false, false);
  end loop;
end $$;

-- Кластеры: от cluster_n рефералов с регистрацией в одну минуту
create or replace function public.ref_cluster_scan(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update referrals r set flags = array_append(r.flags, 'cluster')
   where r.referrer = p_uid and not ('cluster' = any(r.flags)) and r.status <> 'revoked'
     and (select count(*) from referrals x where x.referrer = p_uid and date_trunc('minute', x.bound_at) = date_trunc('minute', r.bound_at)) >= ref_num('cluster_n', 5);
end $$;

-- ---------- Пересчёт этапов ----------
-- Без параметра: все живые рефералы (cron раз в час). С параметром: только связанные с игроком (лениво при открытии экрана).
create or replace function public.ref_recount(p_player uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  r referrals%rowtype; e players%rowtype; n int := 0; v_rolls int; v_days int; st jsonb; flg text[]; rev boolean; ref_id uuid;
  s1 int := coalesce((select (rule->>'rolls')::int from ref_stages where code = 1), 30);
  s2 record; s3 int := coalesce((select (rule->>'age_days')::int from ref_stages where code = 3), 14);
  h jsonb := ref_cfg_get('hold_h'); acts int;
begin
  select (rule->>'rolls')::int as rolls, (rule->>'days')::int as days, (rule->>'window')::int as win into s2 from ref_stages where code = 2;
  for r in select * from referrals where status <> 'revoked' and (stage < 3 or status = 'pending')
            and bound_at > now() - interval '90 days' and (p_player is null or referee = p_player or referrer = p_player)
            for update skip locked loop
    select * into e from players where id = r.referee;
    if ref_banned(e) then continue; end if;
        st := r.stage_at; flg := r.flags; v_rolls := greatest(r.rolls, coalesce((e.stats->>'n')::int, 0));
    -- этап 1
    if r.stage < 1 and v_rolls >= s1 then
      r.stage := 1; st := st || jsonb_build_object('1', now());
      perform ref_add_ledger(r.referrer, r.referee, 'stage1', 'stage1:' || r.referee, ref_cfg_get('rew_stage1'), (h->>'stage1')::numeric, flg && array['speed', 'ring', 'cluster', 'limit']);
    end if;
    -- этап 2: активный реферал
    if r.stage < 2 and v_rolls >= s2.rolls then
      select count(*) into v_days from player_days where player = r.referee and day between (r.bound_at at time zone 'Europe/Moscow')::date and (r.bound_at at time zone 'Europe/Moscow')::date + s2.win;
      if v_days >= s2.days and coalesce(ref_sub_ok(r.referee), true) then
        r.stage := 2; st := st || jsonb_build_object('2', now()); r.status := 'active';
        if now() - r.bound_at < make_interval(secs => (ref_num('speed_hours', 6) * 3600)::int) and not ('speed' = any(flg)) then flg := array_append(flg, 'speed'); end if;
        select count(*) into acts from referrals x where x.referrer = r.referrer and x.stage_at ? '2' and ((x.stage_at->>'2')::timestamptz at time zone 'Europe/Moscow')::date = ref_msk_day();
        if acts >= ref_num('act_day_limit', 15) and not ('limit' = any(flg)) then flg := array_append(flg, 'limit'); end if;
        if ref_pair_flow(r.referrer, r.referee, r.bound_at) > ref_num('ring_rub', 10000000) and not ('ring' = any(flg)) then flg := array_append(flg, 'ring'); end if;
        rev := flg && array['speed', 'ring', 'cluster', 'limit'];
        perform ref_add_ledger(r.referee,  r.referee, 'stage2', 'stage2:' || r.referee || ':self', ref_cfg_get('rew_stage2_ref'), (h->>'stage2')::numeric, rev);
        perform ref_add_ledger(r.referrer, r.referee, 'stage2', 'stage2:' || r.referee, ref_cfg_get('rew_stage2'), (h->>'stage2')::numeric, rev);
        begin perform media_ref_bonus(r.referrer, r.referee); exception when undefined_function then null; end;   -- +25 МК автору ролика (media.sql)
        perform ref_notify(r.referrer, 'ref2', 'Ваш друг ' || coalesce(nullif(e.nick, ''), 'игрок') || ' дошёл до этапа 2. Награда в удержании до ' || to_char((now() + make_interval(hours => (h->>'stage2')::int)) at time zone 'Europe/Moscow', 'DD.MM HH24:MI') || '.');
      end if;
    end if;
    -- этап 3
    if r.stage = 2 and now() - r.bound_at >= make_interval(days => s3) and ref_stage3_ok(r.referee, r.referrer) then
      r.stage := 3; st := st || jsonb_build_object('3', now());
      if ref_pair_flow(r.referrer, r.referee, r.bound_at) > ref_num('ring_rub', 10000000) and not ('ring' = any(flg)) then flg := array_append(flg, 'ring'); end if;
      perform ref_add_ledger(r.referrer, r.referee, 'stage3', 'stage3:' || r.referee, ref_cfg_get('rew_stage3'), (h->>'stage3')::numeric, flg && array['speed', 'ring', 'cluster', 'limit']);
    end if;
    update referrals set stage = r.stage, stage_at = st, rolls = v_rolls, flags = flg, status = case when r.status = 'pending' and r.stage >= 2 then 'active' else r.status end where referee = r.referee;
    if r.stage >= 2 then perform ref_ladder_check(r.referrer); end if;
    n := n + 1;
  end loop;
  -- кластеры проверяем по каждому затронутому пригласившему
  for ref_id in select distinct referrer from referrals where status <> 'revoked' and (p_player is null or referrer = p_player or referee = p_player) loop
    perform ref_cluster_scan(ref_id);
  end loop;
  return n;
end $$;
revoke execute on function public.ref_recount(uuid) from public, anon, authenticated;
grant execute on function public.ref_recount(uuid) to service_role;

-- ---------- Выдача: hold → paid с повторной проверкой ----------
-- Возвращает: paid | deferred | cancelled | review
create or replace function public.ref_release_row(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare l ref_ledger%rowtype; pl players%rowtype; rf referrals%rowtype; ee players%rowtype; rub bigint; today bigint; recent bigint; budget numeric; sub boolean; g jsonb; nxt timestamptz;
begin
  select * into l from ref_ledger where id = p_id for update;
  if not found or l.status <> 'hold' then return coalesce(l.status, 'cancelled'); end if;
  select * into pl from players where id = l.player for update;
  if ref_banned(pl) then update ref_ledger set status = 'cancelled', note = 'бан получателя' where id = l.id; return 'cancelled'; end if;
  if l.referee is not null and l.kind in ('stage1', 'stage2', 'stage3', 'donate') then
    select * into rf from referrals where referee = l.referee;
    select * into ee from players where id = l.referee;
    if rf.status = 'revoked' or ref_banned(ee) then update ref_ledger set status = 'cancelled', note = 'реферал отозван' where id = l.id; return 'cancelled'; end if;
    if 'block' = any(rf.flags) then update ref_ledger set status = 'review' where id = l.id; return 'review'; end if;
    sub := ref_sub_ok(l.referee);
    if sub is null then update ref_ledger set release_at = now() + interval '15 minutes' where id = l.id; return 'deferred'; end if;
    if not sub then update ref_ledger set status = 'cancelled', note = 'нет подписки на канал' where id = l.id; return 'cancelled'; end if;
  end if;
  if pl.ref_debt > 0 then update ref_ledger set release_at = now() + interval '6 hours' where id = l.id; return 'deferred'; end if;
  rub := coalesce((l.reward->>'rub')::bigint, 0);
  if rub > 0 then
    select coalesce(sum((reward->>'rub')::bigint), 0) into recent from ref_ledger where player = l.player and status = 'paid' and paid_at > now() - interval '24 hours' and kind <> 'welcome';
    if l.kind <> 'welcome' and recent > 0 and recent + rub > ref_num('player_cap_rub', 30000000) then
      update ref_ledger set release_at = now() + interval '1 hour' where id = l.id; return 'deferred';
    end if;
    select coalesce(sum((reward->>'rub')::bigint), 0) into today from ref_ledger where status = 'paid' and paid_at >= ref_msk_start() and kind not in ('revoke');
    if today > 0 and today + rub > ref_num('day_budget_rub', 2000000000) then
      nxt := ref_msk_start() + interval '1 day';
      update ref_ledger set release_at = nxt where id = l.id; return 'deferred';
    end if;
  end if;
  g := ref_grant(l.player, l.reward);
  update ref_ledger set status = 'paid', paid_at = now(), reward = l.reward || jsonb_build_object('got', g) where id = l.id;
  if l.kind = 'ladder' then insert into ref_claims (player, n) values (l.player, substr(l.key, 8)::int) on conflict do nothing; end if;
  if l.kind in ('stage1', 'stage2', 'stage3') and l.referee <> l.player then
    perform ref_notify(l.player, 'paid', 'Награда выдана: ' || coalesce(nullif((select nick from players where id = l.referee), ''), 'друг') || ', этап ' || right(l.kind, 1) || '.');
  end if;
  return 'paid';
end $$;

create or replace function public.ref_release(p_limit int default 200) returns int
language plpgsql security definer set search_path = public as $$
declare l record; n int := 0;
begin
  for l in select id from ref_ledger where status = 'hold' and release_at <= now() and kind <> 'ladder' order by release_at limit p_limit loop
    if ref_release_row(l.id) = 'paid' then n := n + 1; end if;
  end loop;
  return n;
end $$;
create or replace function public.ref_release_for(p_uid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare l record; n int := 0;
begin
  for l in select id from ref_ledger where player = p_uid and status = 'hold' and release_at <= now() and kind <> 'ladder' order by release_at limit 30 loop
    if ref_release_row(l.id) = 'paid' then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.ref_release_row(bigint), public.ref_release(int), public.ref_release_for(uuid) from public, anon, authenticated;
grant execute on function public.ref_release(int) to service_role;

-- ---------- Ступень лестницы (A3): идемпотентна по ref_claims и по ключу ledger ----------
create or replace function public.ref_claim(p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l ref_ledger%rowtype; o text;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  perform 1 from players where id = uid for update;
  perform ref_recount(uid);
  select * into l from ref_ledger where player = uid and key = 'ladder:' || p_n;
  if not found then return jsonb_build_object('err', 'locked'); end if;
  if l.status = 'paid' then return jsonb_build_object('err', 'claimed'); end if;
  if l.status = 'review' then return jsonb_build_object('err', 'review'); end if;
  if l.status = 'cancelled' then return jsonb_build_object('err', 'cancelled'); end if;
  if l.release_at > now() then return jsonb_build_object('err', 'hold', 'at', (extract(epoch from l.release_at) * 1000)::bigint); end if;
  o := ref_release_row(l.id);
  if o <> 'paid' then return jsonb_build_object('err', case o when 'deferred' then (case when (select ref_debt from players where id = uid) > 0 then 'debt' else 'later' end) else o end); end if;
  return jsonb_build_object('ok', true, 'reward', (select reward from ref_ledger where id = l.id));
end $$;

-- Погашение долга из баланса (после отзыва наград)
create or replace function public.ref_debt_pay() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; x bigint;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into p from players where id = auth.uid() for update;
  x := least(p.balance, p.ref_debt);
  if x <= 0 then return jsonb_build_object('err', case when p.ref_debt = 0 then 'nodebt' else 'rub' end); end if;
  update players set balance = balance - x, ref_debt = ref_debt - x where id = p.id;
  return jsonb_build_object('ok', true, 'paid', x, 'left', p.ref_debt - x);
end $$;

-- ---------- Бан реферала → отзыв наград (A6.7) ----------
create or replace function public.ref_on_ban(p_uid uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare rf referrals%rowtype; l record; taken bigint; bal bigint; n_banned int; hard boolean;
begin
  hard := coalesce(p_reason, '') ~* coalesce(ref_cfg_get('revoke_regex') #>> '{}', '(мульти|накрут|мошен)');
  for rf in select * from referrals where referee = p_uid and status <> 'revoked' for update loop
    update referrals set status = 'revoked', revoked_at = now() where referee = p_uid;
    update ref_ledger set status = 'cancelled', note = 'реферал забанен' where referee = p_uid and status in ('hold', 'review') and kind in ('stage1', 'stage2', 'stage3', 'donate');
    if hard then
      for l in select * from ref_ledger where referee = p_uid and status = 'paid' and player = rf.referrer and kind in ('stage1', 'stage2', 'stage3', 'donate')
                and paid_at > now() - make_interval(days => ref_num('revoke_days', 30)::int) loop
        taken := coalesce((l.reward->>'rub')::bigint, 0);
        insert into ref_ledger (player, referee, kind, key, reward, status, paid_at, note)
        values (l.player, p_uid, 'revoke', 'revoke:' || l.id, jsonb_build_object('rub', -taken), 'paid', now(), 'отзыв: ' || coalesce(p_reason, ''))
        on conflict (player, key) do nothing;
        if found and taken > 0 then
          select balance into bal from players where id = l.player for update;
          update players set balance = balance - least(bal, taken), ref_debt = ref_debt + (taken - least(bal, taken)) where id = l.player;
        end if;
      end loop;
    end if;
    select count(*) into n_banned from referrals r
     where r.referrer = rf.referrer and r.status = 'revoked' and r.revoked_at > now() - interval '30 days';
    if n_banned >= ref_num('ban_alert_n', 3) then
      update referrals set flags = array_append(flags, 'block') where referrer = rf.referrer and status <> 'revoked' and not ('block' = any(flags));
      insert into ref_alerts (player, kind, data) values (rf.referrer, 'banned3', jsonb_build_object('n', n_banned));
    end if;
    perform ref_ladder_check(rf.referrer);
  end loop;
end $$;

drop trigger if exists players_ref_ban on public.players;
create or replace function public.players_ref_ban_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.banned_until is not null and new.banned_until > now() and (old.banned_until is null or old.banned_until <= now()) then
    perform ref_on_ban(new.id, new.ban_reason);
  end if;
  return new;
end $$;
create trigger players_ref_ban after update of banned_until on public.players for each row execute function public.players_ref_ban_trg();

-- ---------- Экран «Друзья» (A4) ----------
-- Список друзей постранично (по 20), журнал 30 записей. Ники, не username и не id. Флаги и причины проверок игроку не показываем.
create or replace function public.ref_state(p_off int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p players%rowtype; s1 int := coalesce((select (rule->>'rolls')::int from ref_stages where code = 1), 30); act int;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  select * into p from players where id = uid;
  if not found then raise exception 'no player'; end if;
  if ref_banned(p) then return jsonb_build_object('banned', true); end if;
  insert into player_days (player, day) values (uid, ref_msk_day()) on conflict do nothing;
  perform ref_recount(uid);
  perform ref_release_for(uid);
  act := ref_active_count(uid);
  return jsonb_build_object(
    'code', p.ref_code, 'link_base', coalesce(ref_cfg_get('link_base') #>> '{}', ''), 'now', (extract(epoch from now()) * 1000)::bigint,
    'on', coalesce((ref_cfg_get('enabled') #>> '{}')::boolean, true),
    'referrer', (select nullif(nick, '') from players where id = p.ref_by),
    'can_bind', p.ref_by is null and now() - p.created_at < interval '24 hours' and coalesce((p.stats->>'n')::int, 0) < s1 and not exists (select 1 from referrals where referrer = uid),
    'bind_until', (extract(epoch from p.created_at + interval '24 hours') * 1000)::bigint,
    'invited', (select count(*) from referrals where referrer = uid and status <> 'revoked'),
    'active', act, 'debt', p.ref_debt, 'boost', ref_boost_mult(), 'dm', p.can_dm,
    'friends', (select coalesce(jsonb_agg(q.f order by q.at desc), '[]'::jsonb) from (
        select jsonb_build_object('nick', coalesce(nullif(e.nick, ''), 'Игрок'), 'stage', r.stage, 'at', (extract(epoch from r.bound_at) * 1000)::bigint,
          'status', case when r.status = 'revoked' then 'revoked'
                         when exists (select 1 from ref_ledger l where l.player = uid and l.referee = r.referee and l.status = 'review') then 'review'
                         when exists (select 1 from ref_ledger l where l.player = uid and l.referee = r.referee and l.status = 'hold') then 'hold'
                         when r.stage >= 2 then 'active' else 'pending' end,
          'until', (select (extract(epoch from min(l.release_at)) * 1000)::bigint from ref_ledger l where l.player = uid and l.referee = r.referee and l.status = 'hold')) as f, r.bound_at as at
        from referrals r join players e on e.id = r.referee where r.referrer = uid order by r.bound_at desc offset greatest(p_off, 0) limit 20) q),
    'ledger', (select coalesce(jsonb_agg(q.x order by q.id desc), '[]'::jsonb) from (
        select l.id, jsonb_build_object('id', l.id, 'kind', l.kind, 'who', (select nullif(nick, '') from players where id = l.referee and l.referee <> uid), 'status', l.status,
          'rub', coalesce((l.reward->>'rub')::bigint, 0), 'luck', coalesce((l.reward->>'luck')::int, 0), 'items', coalesce(l.reward->'items', '[]'::jsonb),
          'at', (extract(epoch from l.created_at) * 1000)::bigint, 'until', (extract(epoch from l.release_at) * 1000)::bigint) as x
        from ref_ledger l where l.player = uid order by l.id desc limit 30) q),
    'ladder', (select coalesce(jsonb_agg(jsonb_build_object('n', d.n, 'title', d.title, 'reward', d.reward,
        'state', case when l.status = 'paid' then 'claimed' when l.status = 'review' then 'review' when l.status = 'cancelled' then 'cancelled'
                      when l.status = 'hold' and l.release_at > now() then 'hold' when l.status = 'hold' then 'ready' else 'locked' end,
        'at', case when l.status = 'hold' then (extract(epoch from l.release_at) * 1000)::bigint end) order by d.n), '[]'::jsonb)
      from ref_ladder d left join ref_ledger l on l.player = uid and l.key = 'ladder:' || d.n));
end $$;

-- ---------- Рейтинг приглашающих ----------
create or replace function public.ref_top(p_period text default 'week') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); since timestamptz; res jsonb; mine int; rk int;
begin
  if uid is null then raise exception 'unauthorized'; end if;
  since := case p_period when 'week' then date_trunc('week', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow'
                         when 'season' then (ref_cfg_get('season_start') #>> '{}')::timestamptz else '-infinity'::timestamptz end;
  with t as (
    select r.referrer, count(*)::int as n from referrals r join players e on e.id = r.referee join players p on p.id = r.referrer
     where r.stage >= 2 and r.status in ('active', 'review') and (r.stage_at->>'2')::timestamptz >= since
       and not (e.banned_until is not null and e.banned_until > now()) and not (p.banned_until is not null and p.banned_until > now())
     group by r.referrer)
  select coalesce(jsonb_agg(jsonb_build_object('nick', coalesce(nullif(p.nick, ''), 'Игрок'), 'n', q.n, 'me', q.referrer = uid, 'title', p.equip->>'title') order by q.n desc, q.referrer), '[]'::jsonb)
    into res from (select * from t order by n desc, referrer limit 20) q join players p on p.id = q.referrer;
  select coalesce(max(n), 0) into mine from (
    select r.referrer, count(*)::int as n from referrals r join players e on e.id = r.referee
     where r.referrer = uid and r.stage >= 2 and r.status in ('active', 'review') and (r.stage_at->>'2')::timestamptz >= since
       and not (e.banned_until is not null and e.banned_until > now()) group by r.referrer) m;
  select count(*) + 1 into rk from (
    select r.referrer, count(*)::int as n from referrals r join players e on e.id = r.referee join players p on p.id = r.referrer
     where r.stage >= 2 and r.status in ('active', 'review') and (r.stage_at->>'2')::timestamptz >= since
       and not (e.banned_until is not null and e.banned_until > now()) and not (p.banned_until is not null and p.banned_until > now()) group by r.referrer) z where z.n > mine;
  return jsonb_build_object('rows', res, 'me', jsonb_build_object('n', mine, 'rank', rk), 'period', p_period);
end $$;

create or replace function public.ref_set_dm(p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  update players set can_dm = coalesce(p_ok, false) where id = auth.uid();
end $$;

-- ---------- Штаб: решения, настройки, призы недели (вызывает бот/cron с service_role, роль проверяется здесь) ----------
create or replace function public.ref_review(p_ledger bigint, p_decision text, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lv int := staff_level(p_staff); l ref_ledger%rowtype; t1 bigint; t2 bigint;
begin
  if lv < 2 then return jsonb_build_object('err', 'role'); end if;
  select * into l from ref_ledger where id = p_ledger for update;
  if not found or l.status <> 'review' then return jsonb_build_object('err', 'state'); end if;
  if p_decision = 'ok' then
    update ref_ledger set status = 'hold', release_at = now(), note = 'проверено штабом' where id = l.id;
    perform ref_release_row(l.id);
    perform ref_notify(l.player, 'review', 'Проверка пройдена: награда будет выдана.');
  elsif p_decision = 'no' then
    update ref_ledger set status = 'cancelled', note = 'отклонено штабом' where id = l.id;
    perform ref_notify(l.player, 'review', 'Награда отклонена штабом. Подробности по правилам, раздел 19.');
  elsif p_decision = 'ban' then
    if lv < 3 then return jsonb_build_object('err', 'role'); end if;
    update ref_ledger set status = 'cancelled', note = 'бан обоих' where id = l.id;
    for t1 in select tg_id from players where id in (l.player, coalesce(l.referee, l.player)) loop
      perform admin_ban(t1, 'Мультиаккаунт или накрутка в реферальной программе (п. 19.1, 19.2)', null, 'ref_ledger #' || l.id);
    end loop;
  else return jsonb_build_object('err', 'decision');
  end if;
  insert into ref_audit (who, what, ref, data) values (p_staff, 'review:' || p_decision, 'ledger:' || l.id, jsonb_build_object('kind', l.kind, 'player', l.player, 'referee', l.referee));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ref_cfg_set(p_key text, p_val jsonb, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare old jsonb;
begin
  if staff_level(p_staff) < 4 then return jsonb_build_object('err', 'role'); end if;
  select val into old from ref_cfg where key = p_key;
  if not found then return jsonb_build_object('err', 'key'); end if;
  update ref_cfg set val = p_val where key = p_key;
  insert into ref_audit (who, what, ref, data) values (p_staff, 'cfg', p_key, jsonb_build_object('old', old, 'new', p_val));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.ref_boost_set(p_from timestamptz, p_to timestamptz, p_mult numeric, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if staff_level(p_staff) < 4 then return jsonb_build_object('err', 'role'); end if;
  if p_to <= p_from or p_mult < 1 or p_mult > 5 then return jsonb_build_object('err', 'bad'); end if;
  insert into ref_boosts (starts_at, ends_at, mult) values (p_from, p_to, p_mult);
  insert into ref_audit (who, what, ref, data) values (p_staff, 'boost', null, jsonb_build_object('from', p_from, 'to', p_to, 'mult', p_mult));
  return jsonb_build_object('ok', true);
end $$;

-- Призы недели топ-3 (раз в неделю, cron в понедельник). Ключ week:<год-неделя> делает вызов идемпотентным.
create or replace function public.ref_week_close(p_staff bigint default 0) returns int
language plpgsql security definer set search_path = public as $$
declare a timestamptz := date_trunc('week', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow' - interval '7 days'; b timestamptz := a + interval '7 days';
  pr jsonb := ref_cfg_get('week_prizes'); r record; i int := 0; k text := to_char(a at time zone 'Europe/Moscow', 'IYYY-IW'); n int := 0;
begin
  if p_staff <> 0 and staff_level(p_staff) < 4 then return -1; end if;
  for r in select x.referrer, count(*) as c from referrals x join players e on e.id = x.referee join players pr2 on pr2.id = x.referrer
           where x.stage >= 2 and x.status in ('active', 'review') and (x.stage_at->>'2')::timestamptz >= a and (x.stage_at->>'2')::timestamptz < b
             and not (e.banned_until is not null and e.banned_until > now()) and not (pr2.banned_until is not null and pr2.banned_until > now())
           group by x.referrer order by c desc, x.referrer limit 3 loop
    i := i + 1;
    if pr -> (i - 1) is not null and ref_add_ledger(r.referrer, null, 'week', 'week:' || k, pr -> (i - 1), 0, false, false) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------- Донатный процент (по умолчанию выключен) ----------
create or replace function public.ref_donate_hook(p_payer uuid, p_stars int, p_order text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rf referrals%rowtype; rub bigint;
begin
  if not coalesce((ref_cfg_get('donate_on') #>> '{}')::boolean, false) then return jsonb_build_object('skip', 'off'); end if;
  select * into rf from referrals where referee = p_payer and status <> 'revoked';
  if not found or rf.bound_at < now() - make_interval(days => ref_num('donate_days', 60)::int) or rf.stage < 2 then return jsonb_build_object('skip', 'none'); end if;
  rub := floor(p_stars * ref_num('stars_rub', 1000) * ref_num('donate_pct', 3) / 100);
  if rub <= 0 then return jsonb_build_object('skip', 'zero'); end if;
  perform ref_add_ledger(rf.referrer, p_payer, 'donate', 'donate:' || p_order, jsonb_build_object('rub', rub), coalesce((ref_cfg_get('hold_h')->>'donate')::numeric, 168), false, false);
  return jsonb_build_object('ok', true, 'rub', rub);
end $$;
create or replace function public.ref_donate_refund(p_order text) returns void
language plpgsql security definer set search_path = public as $$
declare l ref_ledger%rowtype; bal bigint; take bigint;
begin
  select * into l from ref_ledger where kind = 'donate' and key = 'donate:' || p_order for update;
  if not found then return; end if;
  if l.status in ('hold', 'review') then update ref_ledger set status = 'cancelled', note = 'возврат платежа' where id = l.id; return; end if;
  if l.status = 'paid' then
    take := coalesce((l.reward->>'rub')::bigint, 0);
    insert into ref_ledger (player, referee, kind, key, reward, status, paid_at, note) values (l.player, l.referee, 'revoke', 'revoke:' || l.id, jsonb_build_object('rub', -take), 'paid', now(), 'возврат платежа') on conflict (player, key) do nothing;
    if found then
      select balance into bal from players where id = l.player for update;
      update players set balance = balance - least(bal, take), ref_debt = ref_debt + (take - least(bal, take)) where id = l.player;
    end if;
  end if;
end $$;

-- ---------- Для cron-функции ref-cron (service_role) ----------
create or replace function public.ref_sub_targets(p_limit int default 200) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('player', q.id, 'tg', q.tg_id)), '[]'::jsonb) from (
    select distinct e.id, e.tg_id from ref_ledger l join players e on e.id = l.referee
     where l.status = 'hold' and l.release_at <= now() + interval '30 minutes' and l.kind in ('stage1', 'stage2', 'stage3', 'donate')
       and not exists (select 1 from ref_sub_check c where c.player = e.id and c.at > now() - interval '1 day') limit p_limit) q $$;
create or replace function public.ref_sub_set(p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0;
begin
  for x in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into ref_sub_check (player, ok, at) values ((x->>'player')::uuid, (x->>'ok')::boolean, now())
    on conflict (player) do update set ok = excluded.ok, at = excluded.at;
    n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.ref_outbox_take(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  with t as (update ref_outbox set sent_at = now() where id in (select id from ref_outbox where sent_at is null order by id limit p_limit for update skip locked) returning id, tg_id, kind, body)
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into r from t;
  return r;
end $$;
-- Очередь штаба: записи на проверку и тревоги, о которых ещё не сообщали
create or replace function public.ref_review_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; a jsonb;
begin
  with t as (update ref_ledger set notified = true where id in (select id from ref_ledger where status = 'review' and not notified order by id limit p_limit for update skip locked) returning id, kind, player, referee, reward)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'reward', t.reward,
     'referrer', (select coalesce(nullif(nick, ''), tg_id::text) from players where id = t.player),
     'referee', (select coalesce(nullif(nick, ''), tg_id::text) from players where id = t.referee),
     'flags', (select flags from referrals where referee = t.referee))), '[]'::jsonb) into r from t;
  with t as (update ref_alerts set notified = true where id in (select id from ref_alerts where not notified order by id limit p_limit for update skip locked) returning id, kind, player, data)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'data', t.data, 'player', (select coalesce(nullif(nick, ''), tg_id::text) from players where id = t.player))), '[]'::jsonb) into a from t;
  return jsonb_build_object('review', r, 'alerts', a);
end $$;
create or replace function public.ref_stats() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('review', (select count(*) from ref_ledger where status = 'review'), 'hold', (select count(*) from ref_ledger where status = 'hold'),
    'paid_today_rub', (select coalesce(sum((reward->>'rub')::bigint), 0) from ref_ledger where status = 'paid' and paid_at >= ref_msk_start() and kind <> 'revoke'),
    'budget_rub', ref_num('day_budget_rub', 0), 'referrals', (select count(*) from referrals where status <> 'revoked'),
    'active', (select count(*) from referrals where stage >= 2 and status in ('active', 'review'))) $$;

-- ---------- Права ----------
revoke execute on function
  public.ref_touch(), public.ref_state(int), public.ref_claim(int), public.ref_top(text), public.ref_set_dm(boolean), public.ref_debt_pay(),
  public.ref_on_ban(uuid, text), public.ref_active_count(uuid), public.ref_ladder_check(uuid), public.ref_cluster_scan(uuid), public.ref_sub_ok(uuid),
  public.ref_pair_flow(uuid, uuid, timestamptz), public.ref_stage3_ok(uuid, uuid), public.ref_review(bigint, text, bigint), public.ref_cfg_set(text, jsonb, bigint),
  public.ref_boost_set(timestamptz, timestamptz, numeric, bigint), public.ref_week_close(bigint), public.ref_donate_hook(uuid, int, text), public.ref_donate_refund(text),
  public.ref_sub_targets(int), public.ref_sub_set(jsonb), public.ref_outbox_take(int), public.ref_review_take(int), public.ref_stats()
  from public, anon, authenticated;
grant execute on function public.ref_touch(), public.ref_state(int), public.ref_claim(int), public.ref_top(text), public.ref_set_dm(boolean), public.ref_debt_pay() to authenticated;
grant execute on function
  public.ref_review(bigint, text, bigint), public.ref_cfg_set(text, jsonb, bigint), public.ref_boost_set(timestamptz, timestamptz, numeric, bigint), public.ref_week_close(bigint),
  public.ref_donate_hook(uuid, int, text), public.ref_donate_refund(text), public.ref_sub_targets(int), public.ref_sub_set(jsonb), public.ref_outbox_take(int),
  public.ref_review_take(int), public.ref_stats(), public.ref_recount(uuid), public.ref_release(int), public.ref_bind_new(uuid, text) to service_role;

-- ---------- Расписание (pg_cron; расширение включается в Supabase: Database → Extensions) ----------
-- Подписку на канал проверяет только Edge Function ref-cron (она же рассылает уведомления и очередь штаба). Её вызывайте раз в 15 минут через pg_net или планировщик Supabase.
-- Если sub_check = off, достаточно чистого SQL:
--   select cron.schedule('ref-release', '*/15 * * * *', $$select public.ref_release()$$);
--   select cron.schedule('ref-recount', '7 * * * *',    $$select public.ref_recount()$$);
--   select cron.schedule('ref-week',    '5 0 * * 1',    $$select public.ref_week_close(0)$$);
