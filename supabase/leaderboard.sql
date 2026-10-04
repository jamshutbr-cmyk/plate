-- Таблица лидеров: топ-50 + место текущего игрока. Два вида:
--   'best'  — по самому дорогому выбитому номеру (stats.best), как раньше;
--   'coins' — по монетам на балансе (players.balance).
-- В поле val приходит значение, по которому построен рейтинг (₽). Остальные поля одинаковы для обоих видов.
-- Выполнять можно повторно. Старая версия без аргумента удаляется, чтобы вызов не был неоднозначным.
drop function if exists public.get_leaderboard();
create or replace function public.get_leaderboard(p_kind text default 'best') returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind is null or p_kind not in ('best', 'coins') then raise exception 'bad kind'; end if;
  return (
    with base as (
      select id, nick, lvl, created_at,
             (stats->>'best')::bigint as best,
             (stats->>'n')::bigint as total,
             case p_kind when 'coins' then balance else (stats->>'best')::bigint end as val
      from players
      where (stats->>'n')::bigint > 0
    ), ranked as (
      select *, row_number() over (order by val desc, total desc, created_at) as rk from base
    )
    select json_build_object(
      'kind', p_kind,
      'top', coalesce((select json_agg(json_build_object('rk', rk, 'id', id, 'nick', nick, 'lvl', lvl, 'best', best, 'total', total, 'val', val, 'me', id = auth.uid()) order by rk)
                       from ranked where rk <= 50), '[]'::json),
      'me',  (select json_build_object('rk', rk, 'id', id, 'nick', nick, 'lvl', lvl, 'best', best, 'total', total, 'val', val)
              from ranked where id = auth.uid())
    )
  );
end $$;
revoke execute on function public.get_leaderboard(text) from public, anon;
grant execute on function public.get_leaderboard(text) to authenticated;
