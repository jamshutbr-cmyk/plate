import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {banActive, bannedBody} from '../supabase/functions/_shared/ban.ts';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('banActive: нет бана, прошедший срок, будущий срок, infinity', () => {
  assert.equal(banActive(null), false);
  assert.equal(banActive(undefined), false);
  assert.equal(banActive(''), false);
  assert.equal(banActive(new Date(Date.now() - 1000).toISOString()), false);
  assert.equal(banActive(new Date(Date.now() + 60000).toISOString()), true);
  assert.equal(banActive('infinity'), true);
});
test('bannedBody: формат ответа клиенту', () => {
  assert.deepEqual(bannedBody('автоклик', 'infinity'), {error: 'banned', reason: 'автоклик', until: 'infinity'});
  assert.equal(bannedBody(null, null).reason, '');
});
test('bans.sql: колонки, журнал, триггер и закрытые админ-функции', () => {
  const s = rd('supabase/bans.sql');
  assert.ok(/add column if not exists banned_until timestamptz/.test(s));
  assert.ok(/add column if not exists ban_reason/.test(s));
  assert.ok(/create table if not exists public\.bans/.test(s) && /enable row level security/.test(s));
  assert.ok(/before update on public\.players/.test(s) && /raise exception 'banned'/.test(s));
  assert.ok(/new\.stats is distinct from old\.stats/.test(s) && /new\.balance > old\.balance/.test(s));
  assert.ok(/revoke execute on function public\.admin_ban\(bigint, text, int, text\), public\.admin_unban\(bigint\) from public, anon, authenticated/.test(s));
  assert.ok(!/grant execute on function public\.admin_(un)?ban/.test(s));
});
test('все Edge Functions с действиями игрока проверяют бан, tg-auth не даёт сессию', () => {
  for (const f of ['generate', 'multi-roll']) assert.ok(/banActive\(pl\.banned_until\)/.test(rd(`supabase/functions/${f}/index.ts`)), f);
  for (const f of ['buy-pass', 'resolve-rolls', 'custom-plate']) assert.ok(/await banOf\(admin,/.test(rd(`supabase/functions/${f}/index.ts`)), f);
  const a = rd('supabase/functions/tg-auth/index.ts');
  assert.ok(a.indexOf('banActive(existing.banned_until)') > 0 && a.indexOf('banActive(existing.banned_until)') < a.indexOf('signInWithPassword'));
});
test('клиент: экран бана подключён в входе, в действиях и в rpc', () => {
  assert.ok(/code==='banned'/.test(rd('js/main.js')) && /showBan/.test(rd('js/main.js')));
  assert.ok(/j\.error==='banned'/.test(rd('js/server.js')) && /isBanErr\(error\)/.test(rd('js/server.js')));
  assert.ok(/handleBan/.test(rd('js/api.js')));
});
