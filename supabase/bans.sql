-- Система банов. Выполнять в SQL Editor один раз (можно повторно).
--
-- Как это работает:
--  1) players.banned_until: null = нет бана, 'infinity' = навсегда, иначе дата окончания. players.ban_reason: текст, который увидит игрок.
--  2) Триггер players_ban_guard не даёт забаненному менять прогресс (stats, xp, lvl) и получать деньги. Это закрывает все SQL-функции разом
--     (продажа, рынок, аукцион, банк, кейсы), включая уже выданную сессию. Списывать деньги и смотреть своё он по-прежнему может.
--  3) Edge Functions (generate, multi-roll, resolve-rolls, custom-plate, buy-pass) отвечают 403 {error:'banned'}, tg-auth не выдаёт новую сессию.
--  4) Журнал bans хранит историю: кто, когда, за что, до какого срока, доказательства, когда снят.
--
-- Побочный эффект: если у забаненного есть лот на рынке/аукционе, покупка у него вернёт ошибку 'banned' (деньги ему зачислить нельзя). Снимите лоты вручную.
--
-- Использование (только из SQL Editor, клиентам функции недоступны):
--   select public.admin_ban(1804141173, 'Автокликер: ~97 генераций в минуту', null, 'замеры 13.10.2026 05:16-05:25 UTC: +833 за 511 с');  -- навсегда
--   select public.admin_ban(1804141173, 'Подозрение на автокликер', 3, '...');                                                                     -- на 3 дня
--   select public.admin_unban(1804141173);
--   select tg_id, nick, reason, until, created_at, lifted_at from public.bans order by id desc;

alter table public.players
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason   text not null default '';

create table if not exists public.bans (
  id         bigint generated always as identity primary key,
  player     uuid not null references public.players(id) on delete cascade,
  tg_id      bigint not null,
  nick       text not null default '',
  reason     text not null default '',
  evidence   text not null default '',
  until      timestamptz,
  created_at timestamptz not null default now(),
  lifted_at  timestamptz
);
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

-- Блокировка прогресса забаненного. Сработает для любой функции и любого клиента, в том числе service_role.
create or replace function public.players_ban_guard() returns trigger language plpgsql as $$
begin
  if old.banned_until is not null and old.banned_until > now() then
    if new.stats is distinct from old.stats or new.xp is distinct from old.xp or new.lvl is distinct from old.lvl
       or new.balance > old.balance or new.usd > old.usd then
      raise exception 'banned';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists players_ban_guard on public.players;
create trigger players_ban_guard before update on public.players
  for each row execute function public.players_ban_guard();

create or replace function public.admin_ban(p_tg bigint, p_reason text, p_days int default null, p_evidence text default '') returns json
language plpgsql security definer set search_path = public as $$
declare p public.players; u timestamptz;
begin
  select * into p from public.players where tg_id = p_tg;
  if not found then raise exception 'no player'; end if;
  u := case when p_days is null then 'infinity'::timestamptz else now() + make_interval(days => p_days) end;
  update public.players set banned_until = u, ban_reason = coalesce(p_reason, '') where id = p.id;
  insert into public.bans (player, tg_id, nick, reason, evidence, until)
    values (p.id, p.tg_id, coalesce(p.nick, ''), coalesce(p_reason, ''), coalesce(p_evidence, ''), u);
  -- Сбросить выданные сессии, чтобы он не мог обновить токен (токен доступа живёт до часа, но все действия уже заблокированы)
  begin delete from auth.sessions where user_id = p.id; exception when others then null; end;
  return json_build_object('tg_id', p.tg_id, 'nick', p.nick, 'until', u, 'reason', p_reason);
end $$;

create or replace function public.admin_unban(p_tg bigint) returns json
language plpgsql security definer set search_path = public as $$
declare p public.players;
begin
  select * into p from public.players where tg_id = p_tg;
  if not found then raise exception 'no player'; end if;
  update public.players set banned_until = null, ban_reason = '' where id = p.id;
  update public.bans set lifted_at = now() where player = p.id and lifted_at is null;
  return json_build_object('tg_id', p.tg_id, 'nick', p.nick, 'unbanned', true);
end $$;

revoke execute on function public.admin_ban(bigint, text, int, text), public.admin_unban(bigint) from public, anon, authenticated;
