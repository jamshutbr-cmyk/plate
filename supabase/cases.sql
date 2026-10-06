-- Кейсы: за рубли открываем кейс, из него выпадает машина для гаража.
-- Выполнять в SQL Editor ПОСЛЕ schema.sql и shop.sql (shop.sql нужен только для порядка; от него эта часть не зависит).
-- Можно запускать повторно. Шансы, цены и выдачу считает ТОЛЬКО сервер (open_case); клиент их лишь показывает.
-- Зеркала для интерфейса: CASES / CAR_VAL / DUP_PCT в js/config.js и CARS в js/data/cars.js; сверяет tests/cases.test.mjs.

-- ---------- Машины игрока ----------
-- Стартовых машин нет: гараж пуст, первая машина выпадает из кейса.
alter table public.players add column if not exists cars text[] not null default '{}';
alter table public.players alter column cars set default '{}';   -- если колонку создавала прежняя версия файла (со стартовой машиной)
-- Один раз, если нужно забрать прежнюю стартовую машину у всех (раскомментируйте, выполните и закомментируйте обратно):
-- update public.players set cars = array_remove(cars, 'zhiguli');

-- ---------- Классы машин: стоимость класса (₽). Дубликат возвращает DUP_PCT % от неё ----------
create table if not exists public.car_classes (
  r   smallint primary key check (r between 0 and 4),   -- индекс RAR из config.js: 0 хлам … 4 легендарная
  val bigint not null check (val > 0)
);
-- ---------- Машины (зеркало js/data/cars.js: id и класс r) ----------
create table if not exists public.car_defs (
  id text primary key,
  r  smallint not null references public.car_classes(r)
);
-- ---------- Кейсы: цена и веса классов 0..4 в процентах (сумма строго 100) ----------
create table if not exists public.case_defs (
  id    text primary key,
  price bigint  not null check (price > 0),
  w0 numeric not null check (w0 >= 0),
  w1 numeric not null check (w1 >= 0),
  w2 numeric not null check (w2 >= 0),
  w3 numeric not null check (w3 >= 0),
  w4 numeric not null check (w4 >= 0),
  check (w0 + w1 + w2 + w3 + w4 = 100)
);
alter table public.car_classes enable row level security;
alter table public.car_defs    enable row level security;
alter table public.case_defs   enable row level security;
drop policy if exists car_classes_read on public.car_classes;
drop policy if exists car_defs_read    on public.car_defs;
drop policy if exists case_defs_read   on public.case_defs;
create policy car_classes_read on public.car_classes for select using (true);
create policy car_defs_read    on public.car_defs    for select using (true);
create policy case_defs_read   on public.case_defs   for select using (true);
revoke insert, update, delete on public.car_classes, public.car_defs, public.case_defs from anon, authenticated;

insert into public.car_classes (r, val) values
  (0, 20000),
  (1, 80000),
  (2, 500000),
  (3, 4000000),
  (4, 40000000)
on conflict (r) do update set val = excluded.val;

-- Новая машина: добавить строку сюда И в js/data/cars.js (тот же id и r), затем выполнить файл заново.
insert into public.car_defs (id, r) values
  ('zhiguli', 0),
  ('devyatka', 0),
  ('granta', 1),
  ('niva', 1),
  ('camry', 2),
  ('bmw', 2),
  ('gelik', 3),
  ('rs6', 3),
  ('m5', 3),
  ('rrsvr', 3),
  ('huracan', 4)
on conflict (id) do update set r = excluded.r;

-- Новый кейс или правка шансов: строка здесь И в CASES (js/config.js). Кейсы, которых нет в списке, удаляются.
insert into public.case_defs (id, price, w0, w1, w2, w3, w4) values
  ('garage', 150000, 62, 30, 7.5, 0.5, 0),
  ('standard', 600000, 10, 52, 33, 5, 0),
  ('premium', 5000000, 0, 15, 50, 32, 3),
  ('legend', 30000000, 0, 0, 20, 55, 25)
on conflict (id) do update set price = excluded.price,
  w0 = excluded.w0, w1 = excluded.w1, w2 = excluded.w2, w3 = excluded.w3, w4 = excluded.w4;
delete from public.case_defs where id <> all (array['garage', 'standard', 'premium', 'legend']);

-- ---------- Открыть кейс ----------
-- Всё в одной транзакции под блокировкой строки игрока: проверка баланса, списание, розыгрыш, выдача.
-- 1) класс выбирается по весам кейса; класс, в котором нет машин, пропускается, его шанс уходит остальным классам;
-- 2) машина выбирается случайно внутри класса;
-- 3) если машина уже есть, игрок получает назад DUP_PCT % от стоимости класса (дубликат не пропадает впустую),
--    если новая, она добавляется в players.cars.
-- Возвращает {car_id, dup, refund, player: {balance, cars}}.
create or replace function public.open_case(case_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p players%rowtype; c case_defs%rowtype;
  w numeric[]; tot numeric := 0; roll numeric; acc numeric := 0;
  cls int := -1; last_cls int := -1; pick text; dup boolean; refund bigint := 0;
  new_bal bigint; new_cars text[];
  dup_pct constant int := 50;   -- доля стоимости класса, которую возвращает дубликат; зеркало DUP_PCT в config.js
  i int;
begin
  select * into c from case_defs where id = case_id;
  if not found then raise exception 'bad case'; end if;
  select * into p from players where id = auth.uid() for update;
  if not found then raise exception 'no player'; end if;
  if p.balance < c.price then raise exception 'not enough rub'; end if;

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
  if cls < 0 then cls := last_cls; end if;   -- на случай округления на самой границе

  select d.id into pick from car_defs d where d.r = cls order by random() limit 1;
  dup := pick = any(p.cars);
  if dup then
    select k.val * dup_pct / 100 into refund from car_classes k where k.r = cls;
  end if;

  update players set balance = balance - c.price + refund,
                     cars = case when dup then cars else cars || pick end
  where id = p.id
  returning balance, cars into new_bal, new_cars;

  return jsonb_build_object('car_id', pick, 'dup', dup, 'refund', refund,
                            'player', jsonb_build_object('balance', new_bal, 'cars', to_jsonb(new_cars)));
end $$;

-- ---------- Сброс прогресса: как в schema.sql, плюс гараж снова пуст ----------
create or replace function public.reset_progress() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from plates where owner = auth.uid();
  update players set balance = 50000, usd = 0, xp = 0, lvl = 1, cap_c = 100, cap_s = 5,
    daily_last = null, daily_streak = 0, rescue_last = null, seen = '{}', cars = '{}',
    stats = '{"n":0,"best":0,"cls":[0,0,0,0,0],"f":{}}',
    autosell = '{"lvl":0,"on":true,"t1":true,"t2":true,"sp":true,"old":false,"cheap":false,"ceil":0,"every":false,"low":false}'
  where id = auth.uid();
end $$;

-- ---------- Права ----------
-- Клиент не может вписать себе машину: на players у него нет update, а open_case выдаёт только по правилам выше.
revoke execute on function public.open_case(text) from public, anon;
grant  execute on function public.open_case(text) to authenticated;
