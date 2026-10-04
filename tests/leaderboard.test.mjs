// Лидерборд: два вида (best / coins), сервер и клиент согласованы.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../supabase/leaderboard.sql', import.meta.url), 'utf8');
const js = readFileSync(new URL('../js/views/top.js', import.meta.url), 'utf8');

test('get_leaderboard принимает вид, проверяет его и сортирует по val', () => {
  assert.ok(/get_leaderboard\(p_kind text default 'best'\)/.test(sql));
  assert.ok(/p_kind not in \('best', 'coins'\) then raise exception/.test(sql));
  assert.ok(/case p_kind when 'coins' then balance else \(stats->>'best'\)::bigint end as val/.test(sql));
  assert.ok(/order by val desc/.test(sql));
  assert.ok(/'id', id/.test(sql), 'в строках рейтинга нужен id (профиль и стили игрока)');
});

test('права и удаление старой версии без аргумента', () => {
  assert.ok(/drop function if exists public\.get_leaderboard\(\);/.test(sql));
  assert.ok(/revoke execute on function public\.get_leaderboard\(text\) from public, anon;/.test(sql));
  assert.ok(/grant execute on function public\.get_leaderboard\(text\) to authenticated;/.test(sql));
  assert.ok(/security definer set search_path = public/.test(sql));
});

test('клиент: вкладки обоих видов, кэш по видам, значение берётся из val', () => {
  assert.ok(/\['best'/.test(js) && /\['coins'/.test(js));
  assert.ok(/rpc\('get_leaderboard',\{p_kind:k\}\)/.test(js));
  assert.ok(/fmt\(r\.val\)/.test(js));
  assert.ok(/topKind/.test(js));
});
