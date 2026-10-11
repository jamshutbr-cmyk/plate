// Кланы: сверка констант config.js с supabase/clans.sql, инварианты стока денег, права на функции.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLAN, clanCap, clanUpkeep} from '../js/config.js';

const sql = readFileSync(new URL('../supabase/clans.sql', import.meta.url), 'utf8');
const num = (name) => {
  const m = sql.match(new RegExp(`${name}\\s+constant\\s+\\w+\\s*:=\\s*(\\d+)`));
  assert.ok(m, `нет константы ${name} в clans.sql`);
  return Number(m[1]);
};
const fn = (name) => {
  const i = sql.indexOf(`function public.${name}(`);
  assert.ok(i >= 0, `нет функции ${name}`);
  return sql.slice(i, sql.indexOf('$$;', sql.indexOf('$$', i + 20) + 2) + 3);
};

test('константы кланов: config.js и clans.sql совпадают', () => {
  assert.equal(num('create_lvl'), CLAN.createLvl);
  assert.equal(num('create_rub'), CLAN.createRub);
  assert.equal(num('create_usd'), CLAN.createUsd);
  assert.equal(num('create_cd_h'), CLAN.createCdH);
  assert.equal(num('join_cd_h'), CLAN.joinCdH);
  assert.equal(num('join_lvl'), CLAN.joinLvl);
  assert.equal(num('max_req'), CLAN.maxReq);
  assert.equal(num('donate_min'), CLAN.donateMin);
  assert.equal(num('max_deputies'), CLAN.maxDeputies);
  assert.equal(num('upkeep_days'), CLAN.upkeepDays);
  assert.equal(num('idle_days'), CLAN.idleDays);
  assert.ok(sql.includes(`interval '${CLAN.idleDays} days'`));
  assert.ok(sql.includes(`interval '${CLAN.reqDays} days'`));
  assert.ok(sql.includes(`least(${CLAN.capMax}, ${CLAN.capStep} * l)`));
  assert.ok(sql.includes(`5000000::bigint * l * l`) && CLAN.upkeep === 5000000);
  assert.ok(sql.includes(`char_length(name) between ${CLAN.name[0]} and ${CLAN.name[1]}`));
  assert.ok(sql.includes(`char_length(tag) between ${CLAN.tag[0]} and ${CLAN.tag[1]}`));
  assert.ok(sql.includes(`${CLAN.pt}`) && sql.includes('/ 1000000'));
});

test('цены уровней совпадают, максимум 5, цена растёт', () => {
  const m = sql.match(/case l when 2 then (\d+)::bigint when 3 then (\d+)::bigint when 4 then (\d+)::bigint when 5 then (\d+)::bigint end/);
  assert.ok(m, 'не нашли таблицу цен');
  assert.deepEqual(m.slice(1).map(Number), [2, 3, 4, 5].map((l) => CLAN.up[l]));
  assert.equal(CLAN.maxLvl, 5);
  for (let l = 3; l <= 5; l++) assert.ok(CLAN.up[l] > CLAN.up[l - 1] * 2);
  assert.equal(clanUpkeep(1), 5e6);
  assert.equal(clanUpkeep(5), 125e6);
  assert.equal(clanCap(1), 10);
  assert.equal(clanCap(5), 50);
});

test('казна не выводится: нет ни одной функции, возвращающей деньги из казны игроку', () => {
  // единственные места, где растёт баланс игрока: ничего в clans.sql не пишет players.balance + ...
  assert.ok(!/balance\s*=\s*balance\s*\+/.test(sql), 'клановый код не должен начислять деньги игрокам');
  assert.ok(!/usd\s*=\s*usd\s*\+/.test(sql));
  assert.ok(/balance = balance - p_amount/.test(fn('clan_donate')));
  assert.ok(/treasury = treasury - cost/.test(fn('clan_upgrade')));
});

test('порядок блокировок: игрок раньше клана, заявки и журнал без FK на players', () => {
  for (const f of ['clan_donate', 'clan_upgrade', 'clan_leave', 'clan_disband', 'clan_kick', 'clan_set_role', 'clan_transfer', 'clan_settings', 'clan_join', 'clan_create']) {
    const b = fn(f);
    const p = b.search(/from players where id = (auth\.uid\(\)|p_player|p\.id)[^;]*for update/);
    const c = b.search(/from clans where id = [^;]*for update/);
    assert.ok(p >= 0, `${f}: нет блокировки игрока`);
    if (c >= 0) assert.ok(p < c, `${f}: клан заблокирован раньше игрока`);
  }
  for (const t of ['clan_requests', 'clan_log', 'clan_cd']) {
    const i = sql.indexOf(`create table if not exists public.${t}`);
    assert.ok(!sql.slice(i, sql.indexOf(');', i)).includes('references public.players'), `${t}: FK на players ломает порядок блокировок`);
  }
});

test('права: клиентам открыты только действия, внутренние функции закрыты', () => {
  const grant = sql.match(/grant execute on function([\s\S]*?)to authenticated;/)[1];
  for (const f of ['clan_state', 'clan_search', 'clan_leaderboard', 'clan_tags', 'clan_create', 'clan_join', 'clan_donate', 'clan_upgrade', 'clan_kick', 'clan_disband', 'clan_ping'])
    assert.ok(grant.includes(`public.${f}(`), `${f} не открыта игрокам`);
  for (const f of ['clan_tick', 'clan_sweep', 'clan_reset', 'clan_pick_heir', 'clan_champions']) assert.ok(!grant.includes(`public.${f}(`), `${f} не должна быть открыта`);
  assert.ok(/revoke execute on function\s+public\.clan_tick\(bigint\)[\s\S]*from public, anon, authenticated;/.test(sql));
  assert.ok(/revoke all on public\.clans[\s\S]*from anon, authenticated;/.test(sql));
});

test('сброс прогресса и престиж: reset_progress вызывает clan_reset', () => {
  for (const f of ['prestige.sql', 'market.sql']) {
    const t = readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8');
    assert.ok(t.includes("to_regprocedure('public.clan_reset(uuid)')"), `${f} не сбрасывает клан`);
  }
});
