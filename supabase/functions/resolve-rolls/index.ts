// Edge Function resolve-rolls: решения игрока по пакету.
// Вход: { decisions: [{ id, act: 'keep'|'safe'|'sell' }] }. Выход: итоги или { error }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: au, error: ae } = await admin.auth.getUser(token);
  if (ae || !au.user) return json({ error: 'unauthorized' }, 401);
  const uid = au.user.id;

  const body = await req.json().catch(() => ({}));
  // Вход в игру: пакет старше 24 ч решается автоматически, свежий остаётся игроку
  if (body.auto) {
    const { data: old } = await admin.from('pending_rolls').select('created_at').eq('owner', uid).order('created_at').limit(1);
    if (!old || !old.length || Date.now() - Date.parse(old[0].created_at) < 24 * 3600 * 1000) return json({ pending: !!(old && old.length) });
    const { data: r, error: e2 } = await admin.rpc('auto_resolve', { uid });
    return e2 ? json({ error: 'server' }, 500) : json(r);
  }
  const decisions = Array.isArray(body.decisions) ? body.decisions : [];

  const { data, error } = await admin.rpc('resolve_rolls', { uid, decisions });
  if (error) {
    const m = error.message;
    if (m.includes('no room')) return json({ error: 'full' }, 409);
    if (m.includes('no safe room')) return json({ error: 'safe_full' }, 409);
    if (m.includes('bad decision')) return json({ error: 'bad' }, 400);
    if (m.includes('no pending')) return json({ error: 'none' }, 404);
    return json({ error: 'server' }, 500);
  }
  return json(data);
});
