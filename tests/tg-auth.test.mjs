import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyInitData, playerPassword} from '../supabase/functions/_shared/tg.ts';

const BOT = '123456:TEST-TOKEN';
function sign(fields, token = BOT) {
  const dcs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({...fields, hash}).toString();
}
const now = Date.now(), fresh = () => ({auth_date: String(Math.floor(now / 1000) - 10), query_id: 'AAA', user: JSON.stringify({id: 42, first_name: 'Аня'})});

test('верная подпись принимается', async () => {
  const u = await verifyInitData(sign(fresh()), BOT, 86400, now);
  assert.equal(u.id, 42);
});
test('чужой токен бота отклоняется', async () => {
  assert.equal(await verifyInitData(sign(fresh(), 'other:token'), BOT, 86400, now), null);
});
test('подмена данных ломает подпись', async () => {
  const s = sign(fresh()).replace('42', '43');
  assert.equal(await verifyInitData(s, BOT, 86400, now), null);
});
test('устаревший auth_date отклоняется', async () => {
  const f = {...fresh(), auth_date: String(Math.floor(now / 1000) - 90000)};
  assert.equal(await verifyInitData(sign(f), BOT, 86400, now), null);
});
test('пароль игрока стабилен и зависит от pepper', async () => {
  assert.equal(await playerPassword(42, 'p1'), await playerPassword(42, 'p1'));
  assert.notEqual(await playerPassword(42, 'p1'), await playerPassword(42, 'p2'));
  assert.notEqual(await playerPassword(42, 'p1'), await playerPassword(43, 'p1'));
});
