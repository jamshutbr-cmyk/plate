-- Новые типы номеров: transit, military, diplomat, retro.
-- Меняет check по колонке type в plates и market_listings на живой базе. Можно запускать повторно.
-- Порядок: ПЕРВЫМ после существующих файлов (schema, seed_regions, shop, cases, market, bank, prestige) и до выдачи новой версии Edge Function generate.
-- Функции (commit_plate, commit_plate_fee, autosell, sell_plates, рынок) типов не перечисляют: «спецномер» для автопродажи = всё, что не civil,
-- поэтому transit и остальные подчиняются флагу sp сами. prestige.sql заново запускать не нужно.
-- Список типов должен совпадать с TYPES в js/config.js и supabase/functions/_shared/engine.ts (сверяет tests/types.test.mjs).
do $$
declare
  t text; c record;
begin
  foreach t in array array['plates', 'market_listings'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    -- снять любой check, который ограничивает колонку type (имя могло быть автоматическим)
    for c in
      select conname from pg_constraint
      where conrelid = ('public.' || t)::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ~ '\mtype\M' and pg_get_constraintdef(oid) ~ 'civil'
    loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_type_check');
    execute format($f$alter table public.%I add constraint %I
      check (type in ('civil','taxi','police','transit','military','diplomat','retro'))$f$, t, t || '_type_check');
  end loop;
end $$;
