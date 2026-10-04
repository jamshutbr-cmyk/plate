-- Магазин: косметика (рамки, титулы, эффекты выпадения), платный регион и свой номер.
-- Выполнять в SQL Editor ПОСЛЕ schema.sql и album.sql. Можно запускать повторно.
-- Ничего существующего не меняет: commit_plate остаётся как есть, поверх него — commit_plate_fee.

-- ---------- Купленное и надетое ----------
alter table public.players add column if not exists owned text[] not null default '{}';          -- id купленных предметов
alter table public.players add column if not exists equip jsonb  not null default '{}';          -- {"skin":"gold","title":"king","drop":"fire"}

-- ---------- Каталог (цены в ₽). Клиент зеркалит его в js/config.js (SHOP), это сверяет tests/shop.test.mjs ----------
create table if not exists public.shop_items (
  id    text primary key,
  slot  text not null check (slot in ('skin', 'title', 'drop')),
  price bigint not null check (price > 0)
);
alter table public.shop_items enable row level security;
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select using (true);
revoke insert, update, delete on public.shop_items from anon, authenticated;

insert into public.shop_items (id, slot, price) values
  ('carbon',    'skin',  1500000),
  ('gold',      'skin',  3000000),
  ('neon',      'skin',  8000000),
  ('driver',    'title',  300000),
  ('collector', 'title', 2000000),
  ('major',     'title', 10000000),
  ('king',      'title', 50000000),
  ('oligarch',  'title', 250000000),
  ('sparks',    'drop',  1000000),
  ('fire',      'drop',  2500000),
  ('ice',       'drop',  2500000),
  ('rainbow',   'drop',  6000000)
on conflict (id) do update set slot = excluded.slot, price = excluded.price;

-- Покупка предмета за ₽
create or replace function public.buy_item(item_id text) returns void
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; it shop_items%rowtype;
begin
  select * into it from shop_items where id = item_id;
  if not found then raise exception 'bad item'; end if;
  select * into p from players where id = auth.uid() for update;
  if item_id = any(p.owned) then raise exception 'already owned'; end if;
  if p.balance < it.price then raise exception 'not enough rub'; end if;
  update players set balance = balance - it.price, owned = owned || item_id where id = p.id;
end $$;

-- Надеть предмет в слот (skin / title / drop). Пустой item_id снимает предмет.
create or replace function public.equip_item(slot_name text, item_id text) returns void
language plpgsql security definer set search_path = public as $$
declare p players%rowtype;
begin
  if slot_name not in ('skin', 'title', 'drop') then raise exception 'bad slot'; end if;
  select * into p from players where id = auth.uid() for update;
  if coalesce(item_id, '') = '' then
    update players set equip = equip - slot_name where id = p.id;
  else
    if not (item_id = any(p.owned)) then raise exception 'not owned'; end if;
    if not exists (select 1 from shop_items s where s.id = item_id and s.slot = slot_name) then raise exception 'bad item'; end if;
    update players set equip = jsonb_set(equip, array[slot_name], to_jsonb(item_id)) where id = p.id;
  end if;
end $$;

-- Титул и рамка других игроков (для рейтинга и чужого профиля). Только эти два поля, не больше 60 игроков за раз.
create or replace function public.get_styles(ids uuid[]) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(id::text, json_build_object('title', equip->>'title', 'skin', equip->>'skin')), '{}'::json)
  from players where id = any(ids[1:60]);
$$;

-- ---------- Платный регион: прокрут = 3000 + fee, всё в одной транзакции ----------
-- Вызывает ТОЛЬКО Edge Function generate (service_role). fee = 0, если регион не выбран.
create or replace function public.commit_plate_fee(uid uuid, pl jsonb, ft int[], fee bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; res jsonb;
begin
  if fee < 0 then raise exception 'bad fee'; end if;
  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;
  if p.balance < 3000 + fee then raise exception 'not enough rub'; end if;
  res := public.commit_plate(uid, pl, ft);   -- лимит коллекции, списание 3000, вставка, опыт, статистика
  if fee > 0 then update players set balance = balance - fee where id = uid; end if;
  return res;
end $$;

-- ---------- Свой номер ----------
-- Вызывает ТОЛЬКО Edge Function custom-plate (service_role): номер и цену считает она.
-- Это покупка, а не находка: статистика (выпало, редкости, рекорд цены), опыт и $ не меняются.
create or replace function public.commit_custom_plate(uid uuid, pl jsonb, cost bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; row_id bigint; ts timestamptz := now();
begin
  if cost <= 0 then raise exception 'bad cost'; end if;
  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;
  if (select count(*) from plates where owner = uid and not in_safe) >= p.cap_c then raise exception 'collection full'; end if;
  if p.balance < cost then raise exception 'not enough rub'; end if;
  insert into plates (owner, country, type, main, reg, region_name, cls, mu, price)
  values (uid, pl->>'country', 'civil', pl->>'main', pl->>'reg', pl->>'rn', (pl->>'cls')::int, pl->'mu', (pl->>'price')::bigint)
  returning id into row_id;
  update players set balance = balance - cost where id = uid;
  return jsonb_build_object('id', row_id, 'ts', (extract(epoch from ts) * 1000)::bigint);
end $$;

-- ---------- Права ----------
-- Новые функции по умолчанию доступны всем: закрываем и открываем только нужным.
revoke execute on function public.commit_plate_fee(uuid, jsonb, int[], bigint) from public, anon, authenticated;
revoke execute on function public.commit_custom_plate(uuid, jsonb, bigint)     from public, anon, authenticated;
grant  execute on function public.commit_plate_fee(uuid, jsonb, int[], bigint) to service_role;
grant  execute on function public.commit_custom_plate(uuid, jsonb, bigint)     to service_role;

revoke execute on function public.buy_item(text), public.equip_item(text, text), public.get_styles(uuid[]) from public, anon;
grant  execute on function public.buy_item(text), public.equip_item(text, text), public.get_styles(uuid[]) to authenticated;
