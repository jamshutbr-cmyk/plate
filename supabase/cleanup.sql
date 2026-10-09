-- Уборка старых служебных записей. Выполнять в SQL Editor в любой момент после market.sql / auction.sql. Можно запускать повторно.
-- Что удаляется (игровые данные игроков НЕ трогаются: номера, балансы, активные лоты и вклады остаются):
--  * market_sales: прочитанные продажи старше 30 дней и любые старше 90 дней;
--  * auction_events: то же самое для событий аукциона;
--  * offers: окна продажи пасса, закончившиеся больше 30 дней назад (нужные будущие окна создаются сами).
-- Проданные номера отдельно чистить не нужно: при продаже строка из plates удаляется сразу.

create or replace function public.cleanup_old() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a bigint := 0; b bigint := 0; c bigint := 0;
begin
  if to_regclass('public.market_sales') is not null then
    delete from market_sales where (seen and created_at < now() - interval '30 days') or created_at < now() - interval '90 days';
    get diagnostics a = row_count;
  end if;
  if to_regclass('public.auction_events') is not null then
    delete from auction_events where (seen and created_at < now() - interval '30 days') or created_at < now() - interval '90 days';
    get diagnostics b = row_count;
  end if;
  if to_regclass('public.offers') is not null then
    delete from offers where ends_at < now() - interval '30 days';
    get diagnostics c = row_count;
  end if;
  return jsonb_build_object('market_sales', a, 'auction_events', b, 'offers', c);
end $$;

-- Только владелец проекта (SQL Editor) и сервер: игрокам функция недоступна
revoke execute on function public.cleanup_old() from public, anon, authenticated;

-- Разовый запуск (покажет, сколько строк удалено):
select public.cleanup_old();

-- Автозапуск раз в сутки в 04:00 UTC. Нужно расширение pg_cron: Dashboard -> Database -> Extensions -> pg_cron -> включить.
-- Раскомментируйте после включения расширения:
-- select cron.schedule('cleanup-old', '0 4 * * *', $$select public.cleanup_old()$$);
