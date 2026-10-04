-- Магазин v2: рамки, эффекты ника, фоны сцены, витрина. Для базы, где shop.sql уже запускали. Безопасно выполнять повторно.
alter table public.shop_items drop constraint if exists shop_items_slot_check;
alter table public.shop_items add constraint shop_items_slot_check check (slot in ('skin', 'title', 'drop', 'nick', 'bg', 'show'));
alter table public.players add column if not exists showcase bigint[] not null default '{}';

insert into public.shop_items (id, slot, price) values
  ('carbon', 'skin', 1500000),
  ('silver', 'skin', 2500000),
  ('bronze', 'skin', 2500000),
  ('gold', 'skin', 3000000),
  ('rose', 'skin', 4000000),
  ('emerald', 'skin', 5000000),
  ('ruby', 'skin', 5000000),
  ('sapphire', 'skin', 5000000),
  ('sunset', 'skin', 7000000),
  ('neon', 'skin', 8000000),
  ('midnight', 'skin', 9000000),
  ('aurora', 'skin', 12000000),
  ('hologram', 'skin', 15000000),
  ('nsilver', 'nick', 400000),
  ('ngold', 'nick', 600000),
  ('nice', 'nick', 800000),
  ('nfire', 'nick', 1000000),
  ('nemerald', 'nick', 1000000),
  ('nneon', 'nick', 1500000),
  ('nrainbow', 'nick', 2500000),
  ('bgspace', 'bg', 1500000),
  ('bggarage', 'bg', 1500000),
  ('bgsunset', 'bg', 2500000),
  ('bgcity', 'bg', 3500000),
  ('bggrid', 'bg', 4500000),
  ('bgrain', 'bg', 5000000),
  ('bgaurora', 'bg', 7000000),
  ('showcase', 'show', 3000000),
  ('driver', 'title', 300000),
  ('collector', 'title', 2000000),
  ('major', 'title', 10000000),
  ('king', 'title', 50000000),
  ('oligarch', 'title', 250000000),
  ('sparks', 'drop', 1000000),
  ('fire', 'drop', 2500000),
  ('ice', 'drop', 2500000),
  ('rainbow', 'drop', 6000000)
on conflict (id) do update set slot = excluded.slot, price = excluded.price;

create or replace function public.equip_item(slot_name text, item_id text) returns void
language plpgsql security definer set search_path = public as $$
declare p players%rowtype;
begin
  if slot_name not in ('skin', 'title', 'drop', 'nick', 'bg') then raise exception 'bad slot'; end if;
  select * into p from players where id = auth.uid() for update;
  if coalesce(item_id, '') = '' then
    update players set equip = equip - slot_name where id = p.id;
  else
    if not (item_id = any(p.owned)) then raise exception 'not owned'; end if;
    if not exists (select 1 from shop_items s where s.id = item_id and s.slot = slot_name) then raise exception 'bad item'; end if;
    update players set equip = jsonb_set(equip, array[slot_name], to_jsonb(item_id)) where id = p.id;
  end if;
end $$;

create or replace function public.get_styles(ids uuid[]) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(id::text, json_build_object('title', equip->>'title', 'skin', equip->>'skin', 'nick', equip->>'nick')), '{}'::json)
  from players where id = any(ids[1:60]);
$$;

-- ---------- витрина: до 3 закреплённых номеров в профиле (нужен предмет showcase) ----------
-- Сохраняем только номера игрока, без повторов, в выбранном порядке.
create or replace function public.set_showcase(ids bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; clean bigint[];
begin
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if not ('showcase' = any(p.owned)) then raise exception 'not owned'; end if;
  select coalesce(array_agg(t.pid order by t.ord), '{}') into clean from (
    select pl.id as pid, min(u.ord) as ord
    from unnest((coalesce(ids, '{}'::bigint[]))[1:3]) with ordinality as u(pid, ord)
    join plates pl on pl.id = u.pid and pl.owner = p.id
    group by pl.id) t;
  update players set showcase = clean where id = p.id;
end $$;

-- Витрина игрока для чужого профиля. Проданные или переданные номера в ответ не попадают.
create or replace function public.get_showcase(pid uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', pl.id, 'country', pl.country, 'type', pl.type, 'main', pl.main,
           'reg', pl.reg, 'rn', pl.region_name, 'cls', pl.cls, 'price', pl.price) order by array_position(p.showcase, pl.id)), '[]'::json)
  from players p join plates pl on pl.id = any(p.showcase) and pl.owner = p.id
  where p.id = pid and 'showcase' = any(p.owned);
$$;

revoke execute on function public.set_showcase(bigint[]), public.get_showcase(uuid) from public, anon;
grant  execute on function public.set_showcase(bigint[]), public.get_showcase(uuid) to authenticated;
grant  execute on function public.equip_item(text, text), public.get_styles(uuid[]) to authenticated;
