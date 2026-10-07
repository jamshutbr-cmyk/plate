// Edge Function buy-pass: покупка пасса тройной прокрутки (только в окне продажи). Вход без параметров.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: au, error: ae } = await admin.auth.getUser(token);
  if (ae || !au.user) return json({ error: 'unauthorized' }, 401);
  const { data, error } = await admin.rpc('buy_triple_pass', { uid: au.user.id });
  if (error) {
    const m = error.message;
    if (m.includes('no window')) return json({ error: 'window' }, 409);
    if (m.includes('pass active')) return json({ error: 'active' }, 409);
    if (m.includes('not enough usd')) return json({ error: 'usd' }, 402);
    return json({ error: 'server' }, 500);
  }
  return json(data);
});
