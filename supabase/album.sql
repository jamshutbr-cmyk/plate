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
