-- Награда игроку за найденный баг (tg_id 1094820359). Запускать вручную в SQL Editor, один раз.
-- Два простых запроса подряд. Если редактор выполняет по одному, запустите сначала первый, потом второй.

create table if not exists public.bug_rewards (
  id         bigint generated always as identity primary key,
  player     uuid not null references public.players(id) on delete cascade,
  tg_id      bigint not null,
  nick       text not null default '',
  rub        bigint not null default 0,
  usd        int not null default 0,
  reason     text not null default '',
  created_at timestamptz not null default now()
);
alter table public.bug_rewards enable row level security;
revoke all on public.bug_rewards from anon, authenticated;

-- Начисление и запись в журнал одним запросом. Если игрока с таким tg_id нет, вернётся 0 строк и ничего не начислится.
with p as (
  update public.players
     set balance = balance + 1500000, usd = usd + 50
   where tg_id = 1094820359
  returning id, tg_id, nick
)
insert into public.bug_rewards (player, tg_id, nick, rub, usd, reason)
select id, tg_id, coalesce(nick, ''), 1500000, 50, 'market list scroll bug'
from p
returning tg_id, nick, rub, usd;
