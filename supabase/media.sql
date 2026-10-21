-- Медиа-программа «Медиа» (ТЗ часть B, v1.0): подтверждённые аккаунты, ролики, медиа-койны (МК), магазин, обмен, серия номеров «Медиа».
-- Выполнять ПОСЛЕ referral.sql (использует ref_cfg-подобные хелперы, ref_notify, ref_pick_car, plate_series, series_issue, staff_level) и bank.sql.
-- Безопасно повторять. Схема не запускалась на живой базе (в среде разработки не было Postgres): при ошибке пришлите текст.
--
-- МК: нельзя купить, продать, передать или выставить на рынок. Они лежат в media_wallet, каждое движение пишется в media_ledger.
-- Курс, комиссия, лимиты, пул и цены магазина живут в таблицах (media_rates, media_shop, media_cfg), а не в функциях.
-- Зеркало констант для показа: блок MEDIA в js/config.js; совпадение сверяет tests/media.test.mjs.

-- ---------- Настройки ----------
create table if not exists public.media_cfg (key text primary key, val jsonb not null);
insert into public.media_cfg (key, val) values
  ('on',            'true'),
  ('reward_post',   '50'),                                                    -- МК за одобренный ролик (умножается на множитель уровня)
  ('reward_ref',    '25'),                                                    -- МК за приведённого игрока (этап 2), без множителя
  ('view_tiers',    '[[1000,100],[5000,300],[10000,600],[50000,2500],[100000,6000],[500000,30000],[1000000,80000]]'),   -- [просмотры, МК], разово за порог на ролик
  ('senior_views',  '50000'),                                                 -- пороги от этого числа подтверждает старший модератор и выше
  ('hold_post_h',   '168'),                                                   -- удержание награды за ролик, часы
  ('hold_views_h',  '72'),
  ('hold_ref_h',    '72'),
  ('keep_days',     '30'),                                                    -- ролик должен висеть минимум столько дней
  ('inactive_days', '60'),                                                    -- без одобренных роликов множитель не действует
  ('week_prizes',   '[1500,1000,500]'),                                       -- «Ролик недели»
  ('min_convert',   '100'),
  ('shop_luck_cap', '5000'),
  ('season_key',    '"2026-S4"'),                                             -- сезон для именного номера «Топ-медиа» (раз за сезон)
  ('sla_h',         '{"account": 24, "post": 48, "views": 72}')
on conflict (key) do nothing;

create table if not exists public.media_levels (level smallint primary key, title text not null, posts int not null, views bigint not null, mult numeric(3,2) not null);
insert into public.media_levels (level, title, posts, views, mult) values
  (1, 'Автор',     1,  0,      1.00),
  (2, 'Блогер',    5,  20000,  1.25),
  (3, 'Топ-медиа', 20, 250000, 1.50)
on conflict (level) do update set title = excluded.title, posts = excluded.posts, views = excluded.views, mult = excluded.mult;

-- ---------- Таблицы ----------
create table if not exists public.media_accounts (
  id bigserial primary key,
  player uuid not null references public.players(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'youtube', 'instagram', 'vk')),
  handle text not null, url text not null, verify_code text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'revoked', 'needs_fix')),
  note text not null default '',
  reviewed_by bigint, reviewed_at timestamptz,
  notified boolean not null default false, escalated boolean not null default false,
  created_at timestamptz not null default now());
alter table public.media_accounts drop constraint if exists media_accounts_status_check;
alter table public.media_accounts add constraint media_accounts_status_check check (status in ('pending', 'verified', 'rejected', 'revoked', 'needs_fix'));
create unique index if not exists media_accounts_handle_uq on public.media_accounts (platform, lower(handle)) where status in ('pending', 'verified', 'needs_fix');
create unique index if not exists media_accounts_player_uq on public.media_accounts (player, platform) where status in ('pending', 'verified', 'needs_fix');

create table if not exists public.media_posts (
  id bigserial primary key,
  player uuid not null references public.players(id) on delete cascade,
  account bigint not null references public.media_accounts(id),
  url text not null, url_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'needs_fix', 'rejected', 'removed')),
  reject_point text, note text not null default '',
  reviewed_by bigint, reviewed_at timestamptz, keep_until timestamptz,
  views_ok bigint not null default 0, tier_paid smallint not null default 0,
  contest boolean not null default false,
  notified boolean not null default false, escalated boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists media_posts_player_idx on public.media_posts (player, created_at desc);

create table if not exists public.media_view_claims (
  id bigserial primary key, post bigint not null references public.media_posts(id) on delete cascade,
  views bigint not null check (views > 0), proof text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_fix')),
  reviewed_by bigint, note text not null default '', at timestamptz not null default now(),
  notified boolean not null default false, escalated boolean not null default false);
create index if not exists media_view_claims_post_idx on public.media_view_claims (post, at desc);

create table if not exists public.media_wallet (
  player uuid primary key references public.players(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  debt bigint not null default 0 check (debt >= 0),
  month_key text, month_earned bigint not null default 0,
  conv_key text, conv_used bigint not null default 0,
  level smallint not null default 0);

create table if not exists public.media_ledger (
  id bigserial primary key, player uuid not null references public.players(id) on delete cascade, delta bigint not null,
  kind text not null, key text not null,
  status text not null default 'paid' check (status in ('hold', 'paid', 'queued', 'cancelled')),
  release_at timestamptz, paid_at timestamptz, note text not null default '',
  created_at timestamptz not null default now(),
  unique (player, key));
create index if not exists media_ledger_due_idx on public.media_ledger (status, release_at);

create table if not exists public.media_shop (
  id text primary key, kind text not null, name text not null, price int not null check (price > 0), stock int,
  per_month int, min_level smallint not null default 1, payload jsonb not null default '{}', active boolean not null default true);

create table if not exists public.media_rates (
  id int primary key default 1 check (id = 1),
  rub_per_mc numeric not null check (rub_per_mc > 0), usd_per_mc numeric not null check (usd_per_mc > 0),
  fee_pct int not null check (fee_pct between 0 and 90), conv_limit_mc bigint not null,
  month_cap_mc bigint not null, month_pool_mc bigint not null, month_pool_used bigint not null default 0,
  month_key text, pending jsonb, pending_at timestamptz);
insert into public.media_rates (id, rub_per_mc, usd_per_mc, fee_pct, conv_limit_mc, month_cap_mc, month_pool_mc)
values (1, 25, 0.0001, 20, 20000, 150000, 50000000) on conflict (id) do nothing;

create table if not exists public.named_requests (
  id bigserial primary key, player uuid not null references public.players(id) on delete cascade,
  src text not null check (src in ('media', 'ref')), season text, body text not null check (char_length(body) between 1 and 40), reg text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'issued')),
  reviewed_by bigint, note text not null default '', created_at timestamptz not null default now(), notified boolean not null default false);
create unique index if not exists named_requests_once on public.named_requests (player, src, coalesce(season, '')) where status <> 'rejected';

create table if not exists public.media_audit (id bigserial primary key, who bigint, what text not null, ref text, at timestamptz not null default now(), data jsonb not null default '{}');

do $$
declare t text;
begin
  foreach t in array array['media_cfg', 'media_levels', 'media_accounts', 'media_posts', 'media_view_claims', 'media_wallet', 'media_ledger', 'media_shop', 'media_rates', 'named_requests', 'media_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Склад серий «Медиа» (по ТЗ media_plate_stock): вид поверх общей таблицы plate_series
create or replace view public.media_plate_stock as select series, cap, issued, rare_only from public.plate_series where kind = 'media';
grant select on public.media_plate_stock to authenticated;
-- Серии: первая буква и две последние. Допустимы только А В Е К М Н О Р С Т У Х. Проверить пересечения с named.js и блат-сериями.
insert into public.plate_series (series, kind, cap, rare_only) values
  ('КЕК', 'media', 500, false), ('МЕМ', 'media', 500, false), ('ТОК', 'media', 500, false),
  ('РЕК', 'media', 500, false), ('ВАУ', 'media', 500, false), ('ХАХ', 'media', 500, false),
  ('ТОР', 'media', 100, true),  ('МАХ', 'media', 100, true)       -- закрытые, только уровень «Топ-медиа»
on conflict (series) do nothing;

-- Косметика и титулы (строки в shop_items нужны для equip_item; цена недостижима)
insert into public.shop_items (id, slot, price) values
  ('med_f_air', 'skin', 1000000000000000), ('med_t_media', 'title', 1000000000000000), ('med_t_blogger', 'title', 1000000000000000),
  ('med_t_top', 'title', 1000000000000000), ('med_d_rec', 'drop', 1000000000000000), ('med_b_studio', 'bg', 1000000000000000)
on conflict (id) do nothing;

-- Магазин (цены только в МК). Зеркало: MEDIA.shop в config.js.
insert into public.media_shop (id, kind, name, price, stock, per_month, min_level, payload) values
  ('med_frame', 'cosm', 'Рамка «Эфир»',    1500, null, null, 1, '{"item": "med_f_air"}'),
  ('med_title', 'cosm', 'Титул «Медиа»',    800, null, null, 1, '{"item": "med_t_media"}'),
  ('med_drop',  'cosm', 'Эффект «Запись»', 2500, null, null, 1, '{"item": "med_d_rec"}'),
  ('med_bg',    'cosm', 'Фон «Студия»',    1200, null, null, 1, '{"item": "med_b_studio"}'),
  ('med_luck',  'luck', 'Прокруты удачи ×10', 200, null, 10, 1, '{"rolls": 10}')
on conflict (id) do nothing;
delete from public.media_shop where id = 'med_case';   -- кейс с машинами убран из программы

-- ---------- Хелперы ----------
create or replace function public.media_key_month() returns text language sql stable as $$ select to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM') $$;
create or replace function public.media_month_start() returns timestamptz language sql stable as $$ select date_trunc('month', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow' $$;
create or replace function public.media_cfg_get(k text) returns jsonb language sql stable set search_path = public as $$ select val from media_cfg where key = k $$;
create or replace function public.media_on() returns boolean language sql stable set search_path = public as $$ select coalesce((select (val #>> '{}')::boolean from media_cfg where key = 'on'), true) $$;

-- Тарифы: заявленное админом изменение вступает в силу со следующих суток (лениво применяется здесь и в release)
create or replace function public.media_rates_roll() returns void language plpgsql security definer set search_path = public as $$
begin
  update media_rates set rub_per_mc = coalesce((pending->>'rub_per_mc')::numeric, rub_per_mc), usd_per_mc = coalesce((pending->>'usd_per_mc')::numeric, usd_per_mc),
    fee_pct = coalesce((pending->>'fee_pct')::int, fee_pct), conv_limit_mc = coalesce((pending->>'conv_limit_mc')::bigint, conv_limit_mc),
    month_cap_mc = coalesce((pending->>'month_cap_mc')::bigint, month_cap_mc), pending = null, pending_at = null
   where id = 1 and pending is not null and pending_at <= now();
  update media_rates set month_key = media_key_month(), month_pool_used = 0 where id = 1 and month_key is distinct from media_key_month();
end $$;

-- Кошелёк под блокировкой, со сбросом месячных счётчиков
create or replace function public.media_wallet_lock(p_uid uuid) returns media_wallet language plpgsql security definer set search_path = public as $$
declare w media_wallet%rowtype; k text := media_key_month();
begin
  insert into media_wallet (player) values (p_uid) on conflict do nothing;
  select * into w from media_wallet where player = p_uid for update;
  if w.month_key is distinct from k then update media_wallet set month_key = k, month_earned = 0 where player = p_uid; end if;
  if w.conv_key is distinct from k then update media_wallet set conv_key = k, conv_used = 0 where player = p_uid; end if;
  select * into w from media_wallet where player = p_uid;
  return w;
end $$;

create or replace function public.media_mult(p_uid uuid) returns numeric language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from media_posts where player = p_uid and status = 'approved' and reviewed_at > now() - make_interval(days => coalesce((media_cfg_get('inactive_days') #>> '{}')::int, 60)))
              then coalesce((select l.mult from media_levels l join media_wallet w on w.level = l.level where w.player = p_uid), 1) else 1 end $$;

create or replace function public.media_add(p_player uuid, p_delta bigint, p_kind text, p_key text, p_hold_h numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare id bigint;
begin
  insert into media_ledger (player, delta, kind, key, status, release_at) values (p_player, p_delta, p_kind, p_key, 'hold', now() + make_interval(secs => (p_hold_h * 3600)::int))
  on conflict (player, key) do nothing returning media_ledger.id into id;
  return id;
end $$;

-- Пересчёт уровня после каждого решения. Уровень сам не падает (его снижает только штаб, п. 19). Титулы «Блогер» и «Топ-медиа» выдаются только по уровню.
create or replace function public.media_level(p_uid uuid) returns smallint
language plpgsql security definer set search_path = public as $$
declare n int; v bigint; lv smallint; w media_wallet%rowtype;
begin
  w := media_wallet_lock(p_uid);
  select count(*), coalesce(sum(views_ok), 0) into n, v from media_posts where player = p_uid and status = 'approved';
  select coalesce(max(level), 0) into lv from media_levels where posts <= n and views <= v;
  if not exists (select 1 from media_accounts where player = p_uid and status = 'verified') then lv := 0; end if;
  lv := greatest(lv, w.level);
  if lv > w.level then
    update media_wallet set level = lv where player = p_uid;
    perform ref_notify(p_uid, 'media_level', 'Новый уровень медиа: ' || (select title from media_levels where level = lv) || '.');
  end if;
  if lv >= 2 then update players set owned = owned || 'med_t_blogger' where id = p_uid and not ('med_t_blogger' = any(owned)); end if;
  if lv >= 3 then update players set owned = owned || 'med_t_top' where id = p_uid and not ('med_t_top' = any(owned)); end if;
  return lv;
end $$;

-- +25 МК автору, чей реф-код привёл игрока до этапа 2 (вызывается из ref_recount). Условие: у автора есть одобренный опубликованный ролик.
create or replace function public.media_ref_bonus(p_referrer uuid, p_referee uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not media_on() then return; end if;
  if exists (select 1 from media_posts where player = p_referrer and status = 'approved') then
    perform media_wallet_lock(p_referrer);
    perform media_add(p_referrer, coalesce((media_cfg_get('reward_ref') #>> '{}')::bigint, 25), 'ref', 'ref:' || p_referee, coalesce((media_cfg_get('hold_ref_h') #>> '{}')::numeric, 72));
  end if;
end $$;

-- Проверка игрока для клиентских функций
create or replace function public.media_gate(p_uid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare p players%rowtype;
begin
  if p_uid is null then raise exception 'unauthorized'; end if;
  select * into p from players where id = p_uid;
  if not found then raise exception 'no player'; end if;
  if p.banned_until is not null and p.banned_until > now() then return 'banned'; end if;
  if not media_on() then return 'off'; end if;
  return null;
end $$;
revoke execute on function public.media_rates_roll(), public.media_wallet_lock(uuid), public.media_mult(uuid), public.media_add(uuid, bigint, text, text, numeric),
  public.media_level(uuid), public.media_ref_bonus(uuid, uuid), public.media_gate(uuid) from public, anon, authenticated;

-- ---------- Подключение аккаунта (B3) ----------
create or replace function public.media_account_add(p_platform text, p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); u text := trim(coalesce(p_url, '')); h text; code text; i int; a constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; id bigint;
begin
  if g is not null then return jsonb_build_object('err', g); end if;
  if p_platform not in ('tiktok', 'youtube', 'instagram', 'vk') then return jsonb_build_object('err', 'platform'); end if;
  if length(u) > 200 or u !~* '^https://' then return jsonb_build_object('err', 'url'); end if;
  h := case p_platform
    when 'tiktok'    then substring(u from '(?i)^https://(?:www\.)?tiktok\.com/@([A-Za-z0-9._]{2,40})/?(?:[?#].*)?$')
    when 'youtube'   then substring(u from '(?i)^https://(?:www\.|m\.)?youtube\.com/(@[A-Za-z0-9._-]{2,60}|channel/[A-Za-z0-9_-]{10,40}|c/[A-Za-z0-9._-]{2,60})/?(?:[?#].*)?$')
    when 'instagram' then substring(u from '(?i)^https://(?:www\.)?instagram\.com/([A-Za-z0-9._]{2,40})/?(?:[?#].*)?$')
    when 'vk'        then substring(u from '(?i)^https://(?:www\.|m\.)?vk\.(?:com|ru)/([A-Za-z0-9._]{2,40})/?(?:[?#].*)?$') end;
  if h is null then return jsonb_build_object('err', 'url'); end if;
  if (select count(*) from media_accounts where player = uid and status in ('pending', 'verified', 'needs_fix')) >= 4 then return jsonb_build_object('err', 'limit4'); end if;
  code := 'GN-';
  for i in 1..6 loop code := code || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
  begin
    insert into media_accounts (player, platform, handle, url, verify_code) values (uid, p_platform, h, regexp_replace(u, '[?#].*$', ''), code) returning media_accounts.id into id;
  exception when unique_violation then
    if exists (select 1 from media_accounts where player = uid and platform = p_platform and status in ('pending', 'verified', 'needs_fix')) then return jsonb_build_object('err', 'have'); end if;
    return jsonb_build_object('err', 'taken');
  end;
  return jsonb_build_object('ok', true, 'id', id, 'code', code);
end $$;

-- ---------- Подача ролика ----------
-- Нормализация: без трекинговых параметров. url_key = платформа:идентификатор ролика (уникален на весь проект).
create or replace function public.media_post_add(p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); u text := trim(coalesce(p_url, '')); pf text; vid text; hnd text; key text; acc media_accounts%rowtype; pid bigint; me players%rowtype;
begin
  if g is not null then return jsonb_build_object('err', g); end if;
  if length(u) > 300 or u !~* '^https://' then return jsonb_build_object('err', 'url'); end if;
  u := regexp_replace(regexp_replace(u, '[?#].*$', ''), '/+$', '');
  u := regexp_replace(u, '(?i)^https://(www\.|m\.)', 'https://');
  if u ~* '^https://tiktok\.com/@[A-Za-z0-9._]{2,40}/video/[0-9]{8,25}$' then
    pf := 'tiktok'; hnd := substring(u from '(?i)/@([A-Za-z0-9._]+)/'); vid := substring(u from '/video/([0-9]+)$');
  elsif u ~* '^https://youtube\.com/shorts/[A-Za-z0-9_-]{6,20}$' then pf := 'youtube'; vid := substring(u from '/shorts/([A-Za-z0-9_-]+)$');
  elsif u ~* '^https://instagram\.com/(reel|reels|p)/[A-Za-z0-9_-]{5,20}$' then pf := 'instagram'; vid := substring(u from '/(?:reel|reels|p)/([A-Za-z0-9_-]+)$');
  elsif u ~* '^https://vk\.(com|ru)/(clip|video)-?[0-9]+_[0-9]+$' then pf := 'vk'; vid := substring(u from '/(?:clip|video)(-?[0-9]+_[0-9]+)$');
  else return jsonb_build_object('err', 'url'); end if;
  key := pf || ':' || vid;
  select * into me from players where id = uid;
  if me.created_at > now() - interval '7 days' then return jsonb_build_object('err', 'young'); end if;
  select * into acc from media_accounts where player = uid and platform = pf and status = 'verified' and (hnd is null or lower(handle) = lower(hnd));
  if not found then return jsonb_build_object('err', 'account'); end if;
  if exists (select 1 from media_posts where url_key = key) then return jsonb_build_object('err', 'dup'); end if;
  if (select count(*) from media_posts where player = uid and (created_at at time zone 'Europe/Moscow')::date = ref_msk_day()) >= 1 then return jsonb_build_object('err', 'limit_day'); end if;
  if (select count(*) from media_posts where player = uid and created_at > now() - interval '7 days') >= 3 then return jsonb_build_object('err', 'limit_week'); end if;
  begin
    insert into media_posts (player, account, url, url_key) values (uid, acc.id, u, key) returning media_posts.id into pid;
  exception when unique_violation then return jsonb_build_object('err', 'dup'); end;
  return jsonb_build_object('ok', true, 'id', pid);
end $$;

create or replace function public.media_post_contest(p_post bigint, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if media_gate(uid) is not null then return jsonb_build_object('err', media_gate(uid)); end if;
  update media_posts set contest = coalesce(p_on, false) where id = p_post and player = uid and status = 'approved';
  return jsonb_build_object('ok', found);
end $$;

-- ---------- Заявка на просмотры ----------
create or replace function public.media_views_claim(p_post bigint, p_views bigint, p_proof text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); po media_posts%rowtype; mn bigint := coalesce((media_cfg_get('view_tiers') -> 0 ->> 0)::bigint, 1000); cid bigint;
begin
  if g is not null then return jsonb_build_object('err', g); end if;
  select * into po from media_posts where id = p_post and player = uid for update;
  if not found then return jsonb_build_object('err', 'post'); end if;
  if po.status <> 'approved' then return jsonb_build_object('err', 'status'); end if;
  if p_views is null or p_views < mn or p_views <= po.views_ok then return jsonb_build_object('err', 'views'); end if;
  if coalesce(p_proof, '') !~ '^[0-9a-f-]{36}\.(jpe?g|png|webp)$' then return jsonb_build_object('err', 'proof'); end if;
  if exists (select 1 from media_view_claims where post = p_post and at > now() - interval '7 days') then return jsonb_build_object('err', 'limit'); end if;
  insert into media_view_claims (post, views, proof) values (p_post, p_views, p_proof) returning id into cid;
  return jsonb_build_object('ok', true, 'id', cid);
end $$;

-- ---------- Решения штаба (B7) ----------
-- p_kind: account | post | views; p_decision: ok | fix | no; p_point: пункт 19.x при отказе (обязателен).
create or replace function public.media_review(p_kind text, p_id bigint, p_decision text, p_point text, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lv int := staff_level(p_staff); a media_accounts%rowtype; po media_posts%rowtype; c media_view_claims%rowtype; m numeric; v bigint; tiers jsonb; t jsonb; idx int := 0; paid int; mc bigint; txt text;
begin
  if lv < 2 then return jsonb_build_object('err', 'role'); end if;
  if p_decision not in ('ok', 'fix', 'no') then return jsonb_build_object('err', 'decision'); end if;
  if p_decision = 'no' and coalesce(p_point, '') !~ '^19\.([1-9]|1[0-2])$' then return jsonb_build_object('err', 'point'); end if;
  if p_kind = 'account' then
    select * into a from media_accounts where id = p_id for update;
    if not found or a.status not in ('pending', 'needs_fix') then return jsonb_build_object('err', 'state'); end if;
    update media_accounts set status = case p_decision when 'ok' then 'verified' when 'fix' then 'needs_fix' else 'rejected' end, reviewed_by = p_staff, reviewed_at = now(), note = coalesce(p_point, '') where id = a.id;
    txt := case p_decision when 'ok' then 'Аккаунт подтверждён.' when 'fix' then 'Аккаунт нужно доработать: проверьте код в описании профиля.' else 'Аккаунт отклонён (п. ' || p_point || ').' end;
    perform ref_notify(a.player, 'media', txt);
    perform media_level(a.player);
  elsif p_kind = 'post' then
    select * into po from media_posts where id = p_id for update;
    if not found or po.status not in ('pending', 'needs_fix') then return jsonb_build_object('err', 'state'); end if;
    if p_decision = 'ok' then
      if not exists (select 1 from media_accounts where id = po.account and status = 'verified') then return jsonb_build_object('err', 'account'); end if;
      update media_posts set status = 'approved', reviewed_by = p_staff, reviewed_at = now(), keep_until = now() + make_interval(days => coalesce((media_cfg_get('keep_days') #>> '{}')::int, 30)) where id = po.id;
      perform media_wallet_lock(po.player);
      perform media_level(po.player);
      m := media_mult(po.player);
      perform media_add(po.player, floor(coalesce((media_cfg_get('reward_post') #>> '{}')::numeric, 50) * m)::bigint, 'post', 'post:' || po.id, coalesce((media_cfg_get('hold_post_h') #>> '{}')::numeric, 168));
      txt := 'Ролик одобрен. Награда придёт после проверки сохранности.';
    else
      update media_posts set status = case p_decision when 'fix' then 'needs_fix' else 'rejected' end, reject_point = p_point, reviewed_by = p_staff, reviewed_at = now() where id = po.id;
      txt := case p_decision when 'fix' then 'Ролик нужно доработать.' else 'Ролик отклонён (п. ' || p_point || ').' end;
    end if;
    perform ref_notify(po.player, 'media', txt);
  elsif p_kind = 'views' then
    select * into c from media_view_claims where id = p_id for update;
    if not found or c.status not in ('pending', 'needs_fix') then return jsonb_build_object('err', 'state'); end if;
    if c.views >= coalesce((media_cfg_get('senior_views') #>> '{}')::bigint, 50000) and lv < 3 then return jsonb_build_object('err', 'role'); end if;
    select * into po from media_posts where id = c.post for update;
    if po.status <> 'approved' then return jsonb_build_object('err', 'state'); end if;
    if p_decision = 'ok' then
      update media_view_claims set status = 'approved', reviewed_by = p_staff where id = c.id;
      v := greatest(po.views_ok, c.views); tiers := media_cfg_get('view_tiers'); paid := po.tier_paid;
      update media_posts set views_ok = v where id = po.id;
      perform media_level(po.player);
      m := media_mult(po.player);
      for t in select * from jsonb_array_elements(tiers) loop
        idx := idx + 1;
        if idx > paid and (t->>0)::bigint <= v then
          mc := floor((t->>1)::numeric * m)::bigint;
          perform media_add(po.player, mc, 'views', 'views:' || po.id || ':' || (t->>0), coalesce((media_cfg_get('hold_views_h') #>> '{}')::numeric, 72));
          paid := idx;
        end if;
      end loop;
      update media_posts set tier_paid = paid where id = po.id;
      txt := 'Просмотры подтверждены: ' || v || '.';
    else
      update media_view_claims set status = case p_decision when 'fix' then 'needs_fix' else 'rejected' end, reviewed_by = p_staff, note = coalesce(p_point, '') where id = c.id;
      txt := case p_decision when 'fix' then 'Заявка на просмотры требует доработки: нужен скриншот со ссылкой, датой и счётчиком.' else 'Заявка на просмотры отклонена (п. ' || p_point || ').' end;
    end if;
    perform ref_notify(po.player, 'media', txt);
  else return jsonb_build_object('err', 'kind'); end if;
  insert into media_audit (who, what, ref, data) values (p_staff, 'review:' || p_kind || ':' || p_decision, p_kind || ':' || p_id, jsonb_build_object('point', p_point));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Удержание → выплата (B4): месячный лимит игрока и общий пул ----------
create or replace function public.media_release_row(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare l media_ledger%rowtype; w media_wallet%rowtype; r media_rates%rowtype; pl players%rowtype; pid bigint; ok boolean := true; pay bigint; rep bigint; nxt timestamptz;
begin
  perform media_rates_roll();
  select * into l from media_ledger where id = p_id for update;
  if not found or l.status not in ('hold', 'queued') or l.release_at > now() then return coalesce(l.status, 'cancelled'); end if;
  select * into pl from players where id = l.player;
  if pl.banned_until is not null and pl.banned_until > now() then update media_ledger set status = 'cancelled', note = 'бан' where id = l.id; return 'cancelled'; end if;
  if l.kind in ('post', 'views') then
    pid := substring(l.key from '^(?:post|views):([0-9]+)')::bigint;
    select (status = 'approved') into ok from media_posts where id = pid;
    if not coalesce(ok, false) then update media_ledger set status = 'cancelled', note = 'ролик не опубликован' where id = l.id; return 'cancelled'; end if;
  elsif l.kind = 'ref' then
    if not exists (select 1 from media_posts where player = l.player and status = 'approved') then update media_ledger set status = 'cancelled', note = 'нет одобренного ролика' where id = l.id; return 'cancelled'; end if;
  end if;
  w := media_wallet_lock(l.player);
  select * into r from media_rates where id = 1;
  nxt := media_month_start() + interval '1 month';
  if w.month_earned + l.delta > r.month_cap_mc then update media_ledger set status = 'queued', release_at = nxt where id = l.id; return 'queued'; end if;
  if r.month_pool_used + l.delta > r.month_pool_mc then update media_ledger set status = 'queued', release_at = nxt where id = l.id; return 'queued'; end if;
  pay := l.delta; rep := least(w.debt, pay);
  update media_wallet set coins = coins + (pay - rep), debt = debt - rep, month_earned = month_earned + l.delta where player = l.player;
  update media_rates set month_pool_used = month_pool_used + l.delta where id = 1;
  update media_ledger set status = 'paid', paid_at = now() where id = l.id;
  return 'paid';
end $$;

create or replace function public.media_release(p_limit int default 300) returns int
language plpgsql security definer set search_path = public as $$
declare l record; n int := 0;
begin
  for l in select id from media_ledger where status in ('hold', 'queued') and release_at <= now() order by release_at, id limit p_limit loop
    if media_release_row(l.id) = 'paid' then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------- Отзыв (B4): ролик удалён раньше срока или найдена накрутка ----------
create or replace function public.media_revoke_ledger(p_row media_ledger, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare w media_wallet%rowtype; take bigint;
begin
  if p_row.status in ('hold', 'queued') then update media_ledger set status = 'cancelled', note = p_note where id = p_row.id; return; end if;
  if p_row.status <> 'paid' or p_row.delta <= 0 then return; end if;
  insert into media_ledger (player, delta, kind, key, status, paid_at, note) values (p_row.player, -p_row.delta, 'revoke', 'revoke:' || p_row.id, 'paid', now(), p_note) on conflict (player, key) do nothing;
  if found then
    w := media_wallet_lock(p_row.player);
    take := least(w.coins, p_row.delta);
    update media_wallet set coins = coins - take, debt = debt + (p_row.delta - take), month_earned = greatest(0, month_earned - p_row.delta) where player = p_row.player;
    update media_rates set month_pool_used = greatest(0, month_pool_used - p_row.delta) where id = 1;
  end if;
end $$;

-- p_fraud: накрутка / подмена (п. 19.3–19.5): отзываем и после срока хранения. Без неё — только если ролик убран раньше keep_until.
create or replace function public.media_post_remove(p_post bigint, p_reason text, p_fraud boolean, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare po media_posts%rowtype; l media_ledger%rowtype;
begin
  if staff_level(p_staff) < 2 then return jsonb_build_object('err', 'role'); end if;
  select * into po from media_posts where id = p_post for update;
  if not found or po.status = 'removed' then return jsonb_build_object('err', 'state'); end if;
  update media_posts set status = 'removed', note = coalesce(p_reason, '') where id = po.id;
  for l in select * from media_ledger where player = po.player and (key = 'post:' || po.id or key like 'views:' || po.id || ':%') loop
    if l.status in ('hold', 'queued') or coalesce(p_fraud, false) or po.keep_until is null or now() < po.keep_until then perform media_revoke_ledger(l, 'ролик снят: ' || coalesce(p_reason, '')); end if;
  end loop;
  perform ref_notify(po.player, 'media', 'Ролик снят с программы' || case when p_reason is not null and p_reason <> '' then ' (' || p_reason || ')' else '' end || '. Награды по нему отозваны.');
  insert into media_audit (who, what, ref, data) values (p_staff, 'remove', 'post:' || po.id, jsonb_build_object('reason', p_reason, 'fraud', coalesce(p_fraud, false)));
  return jsonb_build_object('ok', true);
end $$;

-- Аннулирование наград игрока за последние N дней (п. 19.1–19.5, 19.8): старший модератор и выше
create or replace function public.media_annul(p_player uuid, p_days int, p_reason text, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l media_ledger%rowtype; n int := 0;
begin
  if staff_level(p_staff) < 3 then return jsonb_build_object('err', 'role'); end if;
  for l in select * from media_ledger where player = p_player and delta > 0 and kind in ('post', 'views', 'ref', 'contest') and created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365))) loop
    perform media_revoke_ledger(l, 'аннулировано: ' || coalesce(p_reason, '')); n := n + 1;
  end loop;
  insert into media_audit (who, what, ref, data) values (p_staff, 'annul', 'player:' || p_player, jsonb_build_object('rows', n, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'rows', n);
end $$;

-- ---------- Магазин «Медиа» (B5) ----------
create or replace function public.media_shop_buy(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); w media_wallet%rowtype; s media_shop%rowtype; bought int; res jsonb := '{}'; it text; p players%rowtype; cap int := coalesce((media_cfg_get('shop_luck_cap') #>> '{}')::int, 5000);
begin
  if g is not null then return jsonb_build_object('err', g); end if;
  select * into p from players where id = uid for update;
  w := media_wallet_lock(uid);
  select * into s from media_shop where id = p_id and active for update;
  if not found then return jsonb_build_object('err', 'item'); end if;
  if w.debt > 0 then return jsonb_build_object('err', 'debt'); end if;
  if w.level < s.min_level then return jsonb_build_object('err', 'level'); end if;
  if s.stock is not null and s.stock <= 0 then return jsonb_build_object('err', 'stock'); end if;
  if s.per_month is not null then
    select count(*) into bought from media_ledger where player = uid and kind = 'shop' and key like 'shop:' || s.id || ':%' and created_at >= media_month_start();
    if bought >= s.per_month then return jsonb_build_object('err', 'limit'); end if;
  end if;
  if w.coins < s.price then return jsonb_build_object('err', 'coins'); end if;
  if s.kind = 'cosm' then
    it := s.payload->>'item';
    if it = any(p.owned) then return jsonb_build_object('err', 'owned'); end if;
  elsif s.kind = 'luck' then
    if p.luck + coalesce((s.payload->>'rolls')::int, 0) > cap then return jsonb_build_object('err', 'limit'); end if;
  end if;
  update media_wallet set coins = coins - s.price where player = uid;
  insert into media_ledger (player, delta, kind, key, status, paid_at) values (uid, -s.price, 'shop', 'shop:' || s.id || ':' || gen_random_uuid()::text, 'paid', now());
  if s.stock is not null then update media_shop set stock = stock - 1 where id = s.id; end if;
  if s.kind = 'cosm' then update players set owned = owned || it where id = uid;
  elsif s.kind = 'luck' then update players set luck = luck + (s.payload->>'rolls')::int where id = uid;
  end if;
  return jsonb_build_object('ok', true, 'res', res, 'coins', w.coins - s.price);
end $$;

-- Номера серии «Медиа» (B6). Цена: обычные 3000 МК, ровные (111–999, 001–009) 8000, желанные (777, 001, 999) 25000; популярные регионы +20%.
-- Цена самого номера в ₽ ниже чистой суммы обмена, чтобы продажа номера не была лазейкой для вывода МК в рубли.
create or replace function public.media_plate_price(p_digits text, p_reg text) returns int language sql immutable as $$
  select ceil((case when p_digits in ('777', '001', '999') then 25000
                    when p_digits ~ '^([1-9])\1\1$' or p_digits ~ '^00[1-9]$' then 8000 else 3000 end)
              * (case when p_reg in ('77', '99', '177', '777', '78', '178', '97') then 1.2 else 1 end))::int $$;

create or replace function public.media_plate_buy(p_series text, p_digits text, p_reg text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); w media_wallet%rowtype; s plate_series%rowtype; price int; r media_rates%rowtype; x jsonb; need smallint;
begin
  if g is not null then return jsonb_build_object('err', g); end if;
  perform media_rates_roll();
  select * into s from plate_series where series = p_series and kind = 'media';
  if not found then return jsonb_build_object('err', 'series'); end if;
  if coalesce(p_digits, '') !~ '^[0-9]{3}$' or p_digits = '000' then return jsonb_build_object('err', 'digits'); end if;
  if not exists (select 1 from regions where country = 'RU' and code = p_reg) then return jsonb_build_object('err', 'reg'); end if;
  perform 1 from players where id = uid for update;
  w := media_wallet_lock(uid);
  need := case when s.rare_only then 3 else 2 end;
  if w.level < need then return jsonb_build_object('err', 'level'); end if;
  if w.debt > 0 then return jsonb_build_object('err', 'debt'); end if;
  if s.issued >= s.cap then return jsonb_build_object('err', 'soldout'); end if;
  price := media_plate_price(p_digits, p_reg);
  if w.coins < price then return jsonb_build_object('err', 'coins'); end if;
  select * into r from media_rates where id = 1;
  x := series_issue(uid, 'media', false, p_series, p_digits, p_reg, floor(price * r.rub_per_mc * (100 - r.fee_pct) / 100)::bigint);
  if x is null then return jsonb_build_object('err', 'taken'); end if;
  update media_wallet set coins = coins - price where player = uid;
  insert into media_ledger (player, delta, kind, key, status, paid_at) values (uid, -price, 'plate', 'plate:' || p_series || ':' || p_digits || ':' || p_reg, 'paid', now());
  return jsonb_build_object('ok', true, 'plate', x, 'price', price);
end $$;

-- ---------- Обмен МК на ₽ и $ (B5) ----------
-- Округление всегда вниз. Один месячный лимит на оба направления. Обратного обмена нет. Долг блокирует обмен.
create or replace function public.media_convert(p_to text, p_amount bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); w media_wallet%rowtype; r media_rates%rowtype; got bigint; mn bigint := coalesce((media_cfg_get('min_convert') #>> '{}')::bigint, 100);
begin
  if g is not null then return jsonb_build_object('err', g); end if;
  if p_to not in ('rub', 'usd') then return jsonb_build_object('err', 'to'); end if;
  perform media_rates_roll();
  perform 1 from players where id = uid for update;
  w := media_wallet_lock(uid);
  select * into r from media_rates where id = 1;
  if p_amount is null or p_amount < mn then return jsonb_build_object('err', 'min'); end if;
  if w.debt > 0 then return jsonb_build_object('err', 'debt'); end if;
  if w.coins < p_amount then return jsonb_build_object('err', 'coins'); end if;
  if w.conv_used + p_amount > r.conv_limit_mc then return jsonb_build_object('err', 'limit'); end if;
  got := floor(p_amount * (case p_to when 'rub' then r.rub_per_mc else r.usd_per_mc end) * (100 - r.fee_pct) / 100);
  if got < 1 then return jsonb_build_object('err', 'min'); end if;
  update media_wallet set coins = coins - p_amount, conv_used = conv_used + p_amount where player = uid;
  if p_to = 'rub' then update players set balance = balance + got where id = uid; else update players set usd = usd + got::int where id = uid; end if;
  insert into media_ledger (player, delta, kind, key, status, paid_at, note) values (uid, -p_amount, 'conv', 'conv:' || gen_random_uuid()::text, 'paid', now(), p_to || ':' || got);
  return jsonb_build_object('ok', true, 'out', got, 'to', p_to, 'left', r.conv_limit_mc - w.conv_used - p_amount);
end $$;

-- ---------- Экран «Медиа» ----------
create or replace function public.media_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g text := media_gate(uid); w media_wallet%rowtype; r media_rates%rowtype; part boolean; n int; v bigint; nxt record; mon timestamptz := media_month_start(); p players%rowtype;
begin
  if g = 'banned' then return jsonb_build_object('banned', true); end if;
  perform media_rates_roll();
  select * into p from players where id = uid;
  w := media_wallet_lock(uid);
  select * into r from media_rates where id = 1;
  part := exists (select 1 from media_accounts where player = uid and status <> 'rejected');
  select count(*), coalesce(sum(views_ok), 0) into n, v from media_posts where player = uid and status = 'approved';
  select * into nxt from media_levels where level > w.level order by level limit 1;
  return jsonb_build_object(
    'on', media_on(), 'part', part, 'now', (extract(epoch from now()) * 1000)::bigint,
    'coins', case when part then w.coins end, 'debt', case when part then w.debt end, 'level', w.level, 'mult', media_mult(uid),
    'approved', n, 'views', v, 'young', p.created_at > now() - interval '7 days',
    'next', case when nxt.level is not null then jsonb_build_object('level', nxt.level, 'title', nxt.title, 'posts', nxt.posts, 'views', nxt.views, 'mult', nxt.mult) end,
    'month', jsonb_build_object('earned', w.month_earned, 'cap', r.month_cap_mc),
    'rates', jsonb_build_object('rub', r.rub_per_mc, 'usd', r.usd_per_mc, 'fee', r.fee_pct, 'limit', r.conv_limit_mc, 'used', w.conv_used, 'min', coalesce((media_cfg_get('min_convert') #>> '{}')::int, 100),
                                'pending', r.pending, 'pending_at', (extract(epoch from r.pending_at) * 1000)::bigint),
    'pool_open', r.month_pool_used < r.month_pool_mc,
    'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'platform', a.platform, 'handle', a.handle, 'url', a.url, 'code', a.verify_code, 'status', a.status, 'note', a.note) order by a.id), '[]'::jsonb) from media_accounts a where a.player = uid),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'url', x.url, 'status', x.status, 'point', x.reject_point, 'views', x.views_ok, 'tier', x.tier_paid, 'contest', x.contest,
                'keep', (extract(epoch from x.keep_until) * 1000)::bigint, 'at', (extract(epoch from x.created_at) * 1000)::bigint,
                'claim', (select c.status from media_view_claims c where c.post = x.id order by c.id desc limit 1),
                'claim_at', (select (extract(epoch from c.at) * 1000)::bigint from media_view_claims c where c.post = x.id order by c.id desc limit 1)) order by x.id desc), '[]'::jsonb)
              from (select * from media_posts where player = uid order by id desc limit 50) x),
    'ledger', (select coalesce(jsonb_agg(jsonb_build_object('delta', l.delta, 'kind', l.kind, 'status', l.status, 'until', (extract(epoch from l.release_at) * 1000)::bigint, 'at', (extract(epoch from l.created_at) * 1000)::bigint) order by l.id desc), '[]'::jsonb)
               from (select * from media_ledger where player = uid order by id desc limit 30) l),
    'shop', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'name', s.name, 'price', s.price, 'stock', s.stock, 'per_month', s.per_month, 'min_level', s.min_level,
               'bought', (select count(*) from media_ledger l where l.player = uid and l.kind = 'shop' and l.key like 'shop:' || s.id || ':%' and l.created_at >= mon),
               'owned', s.kind = 'cosm' and (s.payload->>'item') = any(p.owned)) order by s.price), '[]'::jsonb) from media_shop s where s.active),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('series', t.series, 'cap', t.cap, 'issued', t.issued, 'closed', t.rare_only) order by t.series), '[]'::jsonb) from plate_series t where t.kind = 'media' and (not t.rare_only or w.level >= 3)),
    'named', (select jsonb_build_object('status', q.status, 'body', q.body) from named_requests q where q.player = uid and q.src = 'media' and q.season = (media_cfg_get('season_key') #>> '{}') and q.status <> 'rejected' limit 1));
end $$;

-- ---------- Именной номер по заявке (Топ-медиа раз за сезон; ref: 500 друзей) ----------
create or replace function public.named_request(p_src text, p_body text, p_reg text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); w media_wallet%rowtype; ssn text; b text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'unauthorized'; end if;
  if char_length(b) not between 1 and 40 then return jsonb_build_object('err', 'text'); end if;
  if p_src = 'media' then
    w := media_wallet_lock(uid);
    if w.level < 3 then return jsonb_build_object('err', 'level'); end if;
    ssn := media_cfg_get('season_key') #>> '{}';
  elsif p_src = 'ref' then
    if not exists (select 1 from ref_claims where player = uid and n = 500) then return jsonb_build_object('err', 'level'); end if;
    ssn := null;
  else return jsonb_build_object('err', 'src'); end if;
  begin insert into named_requests (player, src, season, body, reg) values (uid, p_src, ssn, b, coalesce(p_reg, ''));
  exception when unique_violation then return jsonb_build_object('err', 'have'); end;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.named_review(p_id bigint, p_decision text, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q named_requests%rowtype;
begin
  if staff_level(p_staff) < 4 then return jsonb_build_object('err', 'role'); end if;
  select * into q from named_requests where id = p_id for update;
  if not found or q.status <> 'pending' then return jsonb_build_object('err', 'state'); end if;
  update named_requests set status = case p_decision when 'ok' then 'approved' else 'rejected' end, reviewed_by = p_staff where id = q.id;
  perform ref_notify(q.player, 'named', case p_decision when 'ok' then 'Заявка на именной номер одобрена. Номер появится в коллекции.' else 'Заявка на именной номер отклонена.' end);
  insert into media_audit (who, what, ref, data) values (p_staff, 'named:' || p_decision, 'named:' || p_id, jsonb_build_object('body', q.body));
  return jsonb_build_object('ok', true, 'player', q.player, 'body', q.body, 'reg', q.reg);
end $$;
create or replace function public.named_done(p_id bigint) returns void language sql security definer set search_path = public as $$ update named_requests set status = 'issued' where id = p_id and status = 'approved' $$;

-- ---------- Админские настройки (B7): роли проверяются здесь ----------
create or replace function public.media_rates_set(p_rub numeric, p_usd numeric, p_fee int, p_conv bigint, p_cap bigint, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nxt timestamptz := ref_msk_start() + interval '1 day';
begin
  if staff_level(p_staff) < 4 then return jsonb_build_object('err', 'role'); end if;
  if p_rub <= 0 or p_usd <= 0 or p_fee < 0 or p_fee > 90 or p_conv < 100 or p_cap < 1000 then return jsonb_build_object('err', 'bad'); end if;
  update media_rates set pending = jsonb_build_object('rub_per_mc', p_rub, 'usd_per_mc', p_usd, 'fee_pct', p_fee, 'conv_limit_mc', p_conv, 'month_cap_mc', p_cap), pending_at = nxt where id = 1;
  insert into media_audit (who, what, ref, data) values (p_staff, 'rates', null, jsonb_build_object('rub', p_rub, 'usd', p_usd, 'fee', p_fee, 'conv', p_conv, 'cap', p_cap, 'from', nxt));
  return jsonb_build_object('ok', true, 'from', (extract(epoch from nxt) * 1000)::bigint);
end $$;
create or replace function public.media_pool_set(p_pool bigint, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if staff_level(p_staff) < 5 then return jsonb_build_object('err', 'role'); end if;
  if p_pool < 0 then return jsonb_build_object('err', 'bad'); end if;
  update media_rates set month_pool_mc = p_pool where id = 1;
  update media_ledger set release_at = now() where status = 'queued';      -- пул пополнен: замороженные выплаты пробуем снова
  insert into media_audit (who, what, ref, data) values (p_staff, 'pool', null, jsonb_build_object('pool', p_pool));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.media_shop_set(p_id text, p_price int, p_active boolean, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if staff_level(p_staff) < 4 then return jsonb_build_object('err', 'role'); end if;
  update media_shop set price = coalesce(p_price, price), active = coalesce(p_active, active) where id = p_id;
  if not found then return jsonb_build_object('err', 'item'); end if;
  insert into media_audit (who, what, ref, data) values (p_staff, 'shop', p_id, jsonb_build_object('price', p_price, 'active', p_active));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.media_series_add(p_series text, p_cap int, p_closed boolean, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if staff_level(p_staff) < 5 then return jsonb_build_object('err', 'role'); end if;
  if p_series !~ '^[АВЕКМНОРСТУХ]{3}$' or p_cap < 1 then return jsonb_build_object('err', 'bad'); end if;
  if exists (select 1 from plate_series where series = p_series) then return jsonb_build_object('err', 'have'); end if;
  insert into plate_series (series, kind, cap, rare_only) values (p_series, 'media', p_cap, coalesce(p_closed, false));
  insert into media_audit (who, what, ref, data) values (p_staff, 'series', p_series, jsonb_build_object('cap', p_cap, 'closed', p_closed));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.media_program_set(p_on boolean, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if staff_level(p_staff) < 5 then return jsonb_build_object('err', 'role'); end if;
  update media_cfg set val = to_jsonb(coalesce(p_on, true)) where key = 'on';
  insert into media_audit (who, what, ref, data) values (p_staff, 'program', null, jsonb_build_object('on', p_on));
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.media_set_level(p_player uuid, p_level int, p_reason text, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if staff_level(p_staff) < 3 then return jsonb_build_object('err', 'role'); end if;
  perform media_wallet_lock(p_player);
  update media_wallet set level = greatest(0, least(3, p_level)) where player = p_player;
  insert into media_audit (who, what, ref, data) values (p_staff, 'level', 'player:' || p_player, jsonb_build_object('level', p_level, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

-- «Ролик недели»: 1500 / 1000 / 500 МК трём одобренным роликам, чьи авторы согласились на участие (media_post_contest)
create or replace function public.media_week_award(p_posts bigint[], p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr jsonb := media_cfg_get('week_prizes'); i int := 0; po media_posts%rowtype; k text := to_char(now() at time zone 'Europe/Moscow', 'IYYY-IW'); n int := 0; pid bigint;
begin
  if staff_level(p_staff) < 4 then return jsonb_build_object('err', 'role'); end if;
  foreach pid in array coalesce(p_posts, '{}') loop
    i := i + 1; exit when i > 3;
    select * into po from media_posts where id = pid and status = 'approved' and contest;
    if found then
      perform media_wallet_lock(po.player);
      if media_add(po.player, (pr ->> (i - 1))::bigint, 'contest', 'contest:' || k || ':' || i, 0) is not null then n := n + 1; end if;
    end if;
  end loop;
  insert into media_audit (who, what, ref, data) values (p_staff, 'week_award', k, jsonb_build_object('posts', p_posts));
  return jsonb_build_object('ok', true, 'n', n);
end $$;
-- «Топ месяца» по сумме подтверждённых просмотров (именные номера трём первым выдаёт админ вручную через named_request)
create or replace function public.media_month_top(p_month text, p_staff bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a timestamptz; b timestamptz;
begin
  if staff_level(p_staff) < 3 then return jsonb_build_object('err', 'role'); end if;
  a := (coalesce(p_month, media_key_month()) || '-01')::date::timestamp at time zone 'Europe/Moscow'; b := a + interval '1 month';
  return jsonb_build_object('rows', (select coalesce(jsonb_agg(jsonb_build_object('player', q.player, 'nick', q.nick, 'views', q.v) order by q.v desc), '[]'::jsonb) from (
    select po.player, coalesce(nullif(p.nick, ''), p.tg_id::text) as nick, sum(po.views_ok) as v from media_posts po join players p on p.id = po.player
     where po.status = 'approved' and po.reviewed_at >= a and po.reviewed_at < b group by po.player, p.nick, p.tg_id order by v desc limit 10) q));
end $$;

-- ---------- Очередь штаба и сроки (SLA): для бота ----------
create or replace function public.media_queue_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a jsonb; po jsonb; v jsonb; n jsonb; sla jsonb := media_cfg_get('sla_h');
begin
  with t as (update media_accounts set notified = true where id in (select id from media_accounts where status = 'pending' and not notified order by id limit p_limit for update skip locked) returning *)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'platform', t.platform, 'url', t.url, 'code', t.verify_code, 'level', (select level from media_wallet where player = t.player),
          'nick', (select coalesce(nullif(nick, ''), tg_id::text) from players where id = t.player), 'due', t.created_at + make_interval(hours => (sla->>'account')::int))), '[]'::jsonb) into a from t;
  with t as (update media_posts set notified = true where id in (select id from media_posts where status = 'pending' and not notified order by id limit p_limit for update skip locked) returning *)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'url', t.url, 'level', (select level from media_wallet where player = t.player),
          'nick', (select coalesce(nullif(nick, ''), tg_id::text) from players where id = t.player), 'due', t.created_at + make_interval(hours => (sla->>'post')::int))), '[]'::jsonb) into po from t;
  with t as (update media_view_claims set notified = true where id in (select id from media_view_claims where status = 'pending' and not notified order by id limit p_limit for update skip locked) returning *)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'views', t.views, 'proof', t.proof, 'post', (select url from media_posts where id = t.post),
          'nick', (select coalesce(nullif(p.nick, ''), p.tg_id::text) from media_posts x join players p on p.id = x.player where x.id = t.post),
          'senior', t.views >= coalesce((media_cfg_get('senior_views') #>> '{}')::bigint, 50000), 'due', t.at + make_interval(hours => (sla->>'views')::int))), '[]'::jsonb) into v from t;
  with t as (update named_requests set notified = true where id in (select id from named_requests where status = 'pending' and not notified order by id limit p_limit for update skip locked) returning *)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'src', t.src, 'body', t.body, 'reg', t.reg, 'nick', (select coalesce(nullif(nick, ''), tg_id::text) from players where id = t.player))), '[]'::jsonb) into n from t;
  return jsonb_build_object('accounts', a, 'posts', po, 'views', v, 'named', n);
end $$;
-- Просрочка SLA: один раз сообщаем старшему
create or replace function public.media_queue_overdue() returns jsonb
language plpgsql security definer set search_path = public as $$
declare sla jsonb := media_cfg_get('sla_h'); r jsonb;
begin
  with a as (update media_accounts set escalated = true where status = 'pending' and not escalated and created_at < now() - make_interval(hours => (sla->>'account')::int) returning id),
       p as (update media_posts set escalated = true where status = 'pending' and not escalated and created_at < now() - make_interval(hours => (sla->>'post')::int) returning id),
       v as (update media_view_claims set escalated = true where status = 'pending' and not escalated and at < now() - make_interval(hours => (sla->>'views')::int) returning id)
  select jsonb_build_object('accounts', (select coalesce(jsonb_agg(id), '[]'::jsonb) from a), 'posts', (select coalesce(jsonb_agg(id), '[]'::jsonb) from p), 'views', (select coalesce(jsonb_agg(id), '[]'::jsonb) from v)) into r;
  return r;
end $$;
-- Для /media_queue и /media_stats
create or replace function public.media_queue_list(p_limit int default 15) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'platform', platform, 'at', created_at) order by id), '[]'::jsonb) from (select * from media_accounts where status = 'pending' order by id limit p_limit) x),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'url', url, 'at', created_at) order by id), '[]'::jsonb) from (select * from media_posts where status = 'pending' order by id limit p_limit) x),
    'views', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'views', views, 'at', at) order by id), '[]'::jsonb) from (select * from media_view_claims where status = 'pending' order by id limit p_limit) x)) $$;
create or replace function public.media_stats() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('queue_accounts', (select count(*) from media_accounts where status = 'pending'), 'queue_posts', (select count(*) from media_posts where status = 'pending'),
    'queue_views', (select count(*) from media_view_claims where status = 'pending'), 'queued_payouts', (select count(*) from media_ledger where status = 'queued'),
    'paid_month', (select coalesce(sum(delta), 0) from media_ledger where status = 'paid' and delta > 0 and kind in ('post', 'views', 'ref', 'contest') and paid_at >= media_month_start()),
    'pool', (select month_pool_mc from media_rates where id = 1), 'pool_used', (select month_pool_used from media_rates where id = 1),
    'authors', (select count(*) from media_wallet where level >= 1)) $$;

-- ---------- Права ----------
revoke execute on function
  public.media_account_add(text, text), public.media_post_add(text), public.media_post_contest(bigint, boolean), public.media_views_claim(bigint, bigint, text), public.media_state(),
  public.media_shop_buy(text), public.media_plate_buy(text, text, text), public.media_convert(text, bigint), public.named_request(text, text, text),
  public.media_review(text, bigint, text, text, bigint), public.media_release_row(bigint), public.media_release(int), public.media_revoke_ledger(media_ledger, text),
  public.media_post_remove(bigint, text, boolean, bigint), public.media_annul(uuid, int, text, bigint), public.media_plate_price(text, text),
  public.named_review(bigint, text, bigint), public.named_done(bigint), public.media_rates_set(numeric, numeric, int, bigint, bigint, bigint), public.media_pool_set(bigint, bigint),
  public.media_shop_set(text, int, boolean, bigint), public.media_series_add(text, int, boolean, bigint), public.media_program_set(boolean, bigint),
  public.media_set_level(uuid, int, text, bigint), public.media_week_award(bigint[], bigint), public.media_month_top(text, bigint), public.media_queue_take(int),
  public.media_queue_overdue(), public.media_queue_list(int), public.media_stats() from public, anon, authenticated;
grant execute on function public.media_account_add(text, text), public.media_post_add(text), public.media_post_contest(bigint, boolean), public.media_views_claim(bigint, bigint, text),
  public.media_state(), public.media_shop_buy(text), public.media_plate_buy(text, text, text), public.media_convert(text, bigint), public.named_request(text, text, text),
  public.media_plate_price(text, text) to authenticated;
grant execute on function public.media_review(text, bigint, text, text, bigint), public.media_release(int), public.media_post_remove(bigint, text, boolean, bigint),
  public.media_annul(uuid, int, text, bigint), public.named_review(bigint, text, bigint), public.named_done(bigint), public.media_rates_set(numeric, numeric, int, bigint, bigint, bigint),
  public.media_pool_set(bigint, bigint), public.media_shop_set(text, int, boolean, bigint), public.media_series_add(text, int, boolean, bigint), public.media_program_set(boolean, bigint),
  public.media_set_level(uuid, int, text, bigint), public.media_week_award(bigint[], bigint), public.media_month_top(text, bigint), public.media_queue_take(int),
  public.media_queue_overdue(), public.media_queue_list(int), public.media_stats() to service_role;

-- ---------- Расписание ----------
-- Выплата удержанных МК: select cron.schedule('media-release', '*/15 * * * *', $$select public.media_release()$$);
-- (то же делает Edge Function ref-cron; достаточно одного из двух способов)
