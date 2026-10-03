-- Таблица лидеров: топ-50 по самому дорогому номеру + место текущего игрока.
create or replace function public.get_leaderboard() returns json
language sql stable security definer set search_path = public as $$
  with ranked as (
    select id, nick, lvl,
           (stats->>'best')::bigint as best,
           (stats->>'n')::bigint as total,
           row_number() over (order by (stats->>'best')::bigint desc, (stats->>'n')::bigint desc, created_at) as rk
    from players
    where (stats->>'n')::bigint > 0
  )
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'nick', nick, 'lvl', lvl, 'best', best, 'total', total, 'me', id = auth.uid()) order by rk)
                     from ranked where rk <= 50), '[]'::json),
    'me',  (select json_build_object('rk', rk, 'nick', nick, 'lvl', lvl, 'best', best, 'total', total)
            from ranked where id = auth.uid())
  );
$$;
revoke execute on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;
