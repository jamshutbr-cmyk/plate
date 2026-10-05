-- Вставь в SQL Editor и выполни. Безопасно: старые поля ответа не меняются, добавляется только player.
create or replace function public.commit_plate_fee(uid uuid, pl jsonb, ft int[], fee bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p players%rowtype; res jsonb; q record;
begin
  if fee < 0 then raise exception 'bad fee'; end if;
  select * into p from players where id = uid for update;
  if not found then raise exception 'no player'; end if;
  if p.balance < 3000 + fee then raise exception 'not enough rub'; end if;
  res := public.commit_plate(uid, pl, ft);   -- лимит коллекции, списание 3000, вставка, опыт, статистика
  if fee > 0 then update players set balance = balance - fee where id = uid; end if;
  -- Отдаём свежие данные игрока вместе с номером: generate больше не делает отдельный select после прокрута.
  select balance, usd, xp, lvl, stats, seen into q from players where id = uid;
  return res || jsonb_build_object('player', to_jsonb(q));
end $$;
