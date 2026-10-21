// Edge Function media-named: выдача одобренного именного номера (Топ-медиа раз за сезон; 500 друзей). Вызывает бот после named_review (ok).
// Заголовок x-cron-secret = CRON_SECRET. Тело: { id, player, body, reg }. Цена и формат считает customPlate из _shared/engine.ts (как в custom-plate); номер кладёт commit_custom_plate с ценой 0.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import { customPlate } from '../_shared/engine.ts';
import { loadRegions } from '../_shared/regions.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
  try {
    const { id, player, body, reg } = await req.json();
    const { data: pl } = await admin.from('players').select('country').eq('id', player).single();
    if (!pl) return json({ error: 'no player' }, 404);
    const regs = (await loadRegions(admin))[pl.country];
    const letters = String(body).toUpperCase().replace(/[^А-ЯA-Z]/g, ''), digits = String(body).replace(/[^0-9]/g, '');
    const res = customPlate(pl.country, letters, digits, String(reg || ''), regs);
    if ('error' in res) return json({ error: res.error }, 400);
    const { error } = await admin.rpc('commit_custom_plate', { uid: player, pl: res.plate, cost: 0 });
    if (error) return json({ error: error.message }, 409);
    await admin.rpc('named_done', { p_id: id });
    return json({ ok: true, plate: res.plate.main });
  } catch (e) { console.error('media-named', e); return json({ error: 'server' }, 500); }
});
