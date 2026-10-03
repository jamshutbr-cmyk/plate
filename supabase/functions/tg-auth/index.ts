// Edge Function tg-auth: вход через Telegram.
// Вход: { initData: string } → выход: { access_token, refresh_token, expires_at } (обычная сессия Supabase).
// Секреты (supabase secrets set): BOT_TOKEN, PASSWORD_PEPPER. SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY задаёт сама платформа.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import { playerPassword, verifyInitData } from '../_shared/tg.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const { initData } = await req.json().catch(() => ({}));
  if (typeof initData !== 'string' || !initData) return json({ error: 'no initData' }, 400);

  const user = await verifyInitData(initData, Deno.env.get('BOT_TOKEN')!);
  if (!user) return json({ error: 'bad signature' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

  const email = `tg${user.id}@telegram.invalid`;
  const password = await playerPassword(user.id, Deno.env.get('PASSWORD_PEPPER')!);

  // Игрок уже есть?
  const { data: existing } = await admin.from('players').select('id').eq('tg_id', user.id).maybeSingle();
  if (!existing) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { tg_id: user.id },
    });
    // Гонка двух первых запросов: пользователь мог уже появиться — тогда просто логинимся ниже
    if (created?.user) {
      await admin.from('players').upsert({ id: created.user.id, tg_id: user.id }, { onConflict: 'tg_id', ignoreDuplicates: true });
    } else if (error && !/already|exists|registered/i.test(error.message)) {
      return json({ error: 'create failed' }, 500);
    }
  }

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ error: 'login failed' }, 500);
  const s = data.session;
  return json({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at });
});
