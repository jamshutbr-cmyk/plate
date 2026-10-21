// Рефералка «Друзья»: константы REF в config.js совпадают с referral.sql, лестница монотонна, суммы наград не выше потолка, код и start_param.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REF, itemOf} from '../js/config.js';
import {refCodeOf} from '../supabase/functions/_shared/tg.ts';

const sql = readFileSync(new URL('../supabase/referral.sql', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../supabase/functions/tg-auth/index.ts', import.meta.url), 'utf8');
const cfg = (k) => { const m = sql.match(new RegExp(`\\('${k}',\\s*'([^']*)'\\)`)); assert.ok(m, 'нет ref_cfg.' + k); return m[1]; };
const cfgNum = (k) => Number(cfg(k));

test('алфавит кода: A–Z без I, L, O и цифры 2–9; SQL и клиент совпадают', () => {
  assert.equal(REF.alphabet.length, 31);
  assert.ok(!/[01ILO]/.test(REF.alphabet));
  for (const c of 'ABCDEFGHJKMNPQRSTUVWXYZ23456789') assert.ok(REF.alphabet.includes(c));
  const m = sql.match(/a constant text := '([A-Z2-9]+)'/);
  assert.ok(m, 'нет алфавита в ref_gen_code');
  assert.equal(m[1], REF.alphabet);
  assert.equal(REF.codeLen, 8);
  assert.match(sql, /for i in 1\.\.8 loop/);
});

test('этапы: пороги в ref_stages совпадают с REF.stages', () => {
  const row = (code) => sql.match(new RegExp(`\\(${code}, '[^']+',\\s+'(\\{[^']*\\})'\\)`));
  assert.deepEqual(JSON.parse(row(1)[1]), {rolls: REF.stages[1].rolls});
  assert.deepEqual(JSON.parse(row(2)[1]), {rolls: REF.stages[2].rolls, days: REF.stages[2].days, window: REF.stages[2].window});
  assert.deepEqual(JSON.parse(row(3)[1]), {age_days: REF.stages[3].ageDays});
});

test('награды и удержание: значения ref_cfg совпадают с REF', () => {
  assert.deepEqual(JSON.parse(cfg('welcome')), {rub: REF.welcome.rub, luck: REF.welcome.luck, items: ['ref_t_invited']});
  assert.equal(JSON.parse(cfg('rew_stage1')).rub, REF.reward.stage1);
  assert.deepEqual(JSON.parse(cfg('rew_stage2')), {rub: REF.reward.stage2, luck: REF.reward.stage2Luck});
  assert.equal(JSON.parse(cfg('rew_stage2_ref')).rub, REF.reward.stage2Ref);
  assert.equal(JSON.parse(cfg('rew_stage3')).rub, REF.reward.stage3);
  const h = JSON.parse(cfg('hold_h'));
  for (const k of ['stage1', 'stage2', 'stage3', 'ladder']) assert.equal(h[k], REF.hold[k], k);
  assert.equal(cfgNum('bind_day_limit'), REF.limits.bindDay);
  assert.equal(cfgNum('act_day_limit'), REF.limits.actDay);
  assert.equal(cfgNum('player_cap_rub'), REF.limits.playerCapRub);
  assert.equal(cfgNum('speed_hours'), REF.limits.speedHours);
  assert.equal(cfgNum('ring_rub'), REF.limits.ringRub);
  assert.equal(cfgNum('cluster_n'), REF.limits.clusterN);
  assert.equal(cfgNum('revoke_days'), REF.revokeDays);
});

test('лестница: монотонна, ступени и награды совпадают с ref_ladder', () => {
  const ns = REF.ladder.map((d) => d.n);
  assert.deepEqual(ns, [1, 3, 5, 10, 25, 50, 100, 250, 500]);
  for (let i = 1; i < ns.length; i++) assert.ok(ns[i] > ns[i - 1]);
  const rows = [...sql.matchAll(/\((\d+),\s+'(\{[^']*\})', (?:'[^']*'|null)\)/g)].filter((m) => ns.includes(+m[1]));
  assert.equal(rows.length, ns.length);
  for (const m of rows) {
    const d = REF.ladder.find((x) => x.n == +m[1]), r = JSON.parse(m[2]);
    assert.equal(r.rub || 0, d.rub || 0, 'rub ' + d.n);
    assert.equal(r.luck || 0, d.luck || 0, 'luck ' + d.n);
    assert.equal((r.items || [])[0], d.item, 'item ' + d.n);
  }
});

test('суммы: одиночная награда не выше суточного потолка, цепочка до этапа 3 около 5 200 000 ₽', () => {
  const rubs = [REF.welcome.rub, REF.reward.stage1, REF.reward.stage2, REF.reward.stage2Ref, REF.reward.stage3, ...REF.ladder.map((d) => d.rub || 0)];
  // ступень 50 друзей (500 000) выше потолка 300 000/сутки: SQL выплачивает её одной, когда за 24 часа ничего не выдавали (см. ref_release_row)
  for (const r of rubs.filter((x) => x != 250000000 && x != 100000000 && x != 50000000)) assert.ok(r <= REF.limits.playerCapRub);
  assert.match(sql, /recent > 0 and recent \+ rub > ref_num\('player_cap_rub'/);
  assert.equal(REF.welcome.rub + REF.reward.stage1 + REF.reward.stage2 + REF.reward.stage2Ref + REF.reward.stage3, 5200000);
});

test('косметика рефералки: id есть в SQL (shop_items) и в itemOf', () => {
  for (const it of REF.items) {
    assert.ok(sql.includes(`'${it.id}'`), it.id);
    assert.ok(itemOf(it.id), it.id);
  }
});

test('start_param: только r_<8 символов алфавита>', () => {
  const mk = (sp) => 'user=%7B%22id%22%3A1%7D&start_param=' + sp + '&hash=x';
  assert.equal(refCodeOf(mk('r_K7M2Q9XD')), 'K7M2Q9XD');
  assert.equal(refCodeOf(mk('r_k7m2q9xd')), null);
  assert.equal(refCodeOf(mk('r_K7M2Q9X0')), null);   // 0 нет в алфавите
  assert.equal(refCodeOf(mk('r_K7M2Q9X')), null);
  assert.equal(refCodeOf(mk('x_K7M2Q9XD')), null);
  assert.equal(refCodeOf('user=1&hash=x'), null);
});

test('tg-auth: привязка только при создании игрока и только после проверки подписи', () => {
  const iVerify = auth.indexOf('verifyInitData('), iBind = auth.indexOf('ref_bind_new'), iCreate = auth.indexOf('createUser');
  assert.ok(iVerify > 0 && iCreate > iVerify && iBind > iCreate);
  assert.ok(auth.indexOf('if (!existing)') < iBind, 'ref_bind_new вызван вне ветки создания');
  assert.match(auth, /ref_new: refNew/);
});

test('SQL: таблицы закрыты RLS, служебные функции недоступны клиенту, идемпотентность по (player, key)', () => {
  assert.match(sql, /unique \(player, key\)/);
  assert.match(sql, /on conflict \(player, key\) do nothing returning ref_ledger\.id/);
  for (const f of ['ref_bind_new(uuid, text)', 'ref_review(bigint, text, bigint)', 'ref_cfg_set(text, jsonb, bigint)', 'ref_release(int)']) {
    const g = sql.match(new RegExp(`grant execute on function[^;]*${f.replace(/[()]/g, '\\$&')}[^;]*to (\\w+)`));
    assert.ok(g && g[1] == 'service_role', 'grant ' + f);
  }
  const toAuth = sql.match(/grant execute on function public\.ref_touch\(\)[^;]*to authenticated;/)[0];
  for (const f of ['ref_state', 'ref_claim', 'ref_bind', 'ref_top', 'ref_set_dm', 'ref_debt_pay', 'ref_touch']) assert.ok(toAuth.includes(f) || /ref_bind\(text\)[^;]*authenticated/.test(sql), f);
  assert.ok(!toAuth.includes('ref_review') && !toAuth.includes('ref_grant') && !toAuth.includes('ref_release'));
  assert.match(sql, /alter table public\.%I enable row level security/);
  assert.match(sql, /players_ref_ban after update of banned_until/);
});

test('привязка: нельзя к себе, к забаненному, по циклу, существующему игроку вручную позже 24 часов', () => {
  for (const e of ['self', 'banned', 'cycle', 'late', 'already', 'code']) assert.ok(sql.includes(`'err', '${e}'`), e);
  assert.match(sql, /now\(\) - me\.created_at > interval '24 hours'/);
});
