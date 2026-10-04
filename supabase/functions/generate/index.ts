// Edge Function generate: выдаёт игроку номер. Клиент передаёт только JWT — всё остальное считает сервер.
// Выбранный регион платный: к 3000 ₽ добавляется regionFee (считает сервер, списывается атомарно в commit_plate_fee).
// Выход: { plate, unlock: 'cls'|'type'|null, lvup, player: { balance, usd, xp, lvl } } либо { error }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import { mk, feats, regionFee } from '../_shared/engine.ts';
import { loadRegions } from '../_shared/regions.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: au, error: ae } = await admin.auth.getUser(token);
  if (ae || !au.user) return json({ error: 'unauthorized' }, 401);
  const uid = au.user.id;

  const { data: pl } = await admin.from('players').select('country, reg, luck').eq('id', uid).single();
  if (!pl) return json({ error: 'no player' }, 404);

  const regs = (await loadRegions(admin))[pl.country];
  // Буст удачи из банка: пока luck > 0, делаем 3 попытки и берём самый дорогой номер (BANK.luck.best в js/config.js).
  const tries = pl.luck > 0 ? 3 : 1;
  let plate = mk({ country: pl.country, reg: pl.reg }, regs);
  for (let i = 1; i < tries; i++) {
    const alt = mk({ country: pl.country, reg: pl.reg }, regs);
    if (alt.price > plate.price) plate = alt;
  }
  const fee = regionFee(regs, pl.reg);
  const { data, error } = await admin.rpc('commit_plate_fee', { uid, pl: plate, ft: feats(plate), fee });
  if (error) {
    const m = error.message;
    if (m.includes('collection full')) return json({ error: 'full' }, 409);
    if (m.includes('not enough rub')) return json({ error: 'money' }, 402);
    return json({ error: 'server' }, 500);
  }
  if (pl.luck > 0) await admin.rpc('consume_luck', { uid });
  const { data: p2 } = await admin.from('players').select('balance, usd, xp, lvl, stats, seen').eq('id', uid).single();
  return json({
    plate: { ...plate, id: data.id, ts: data.ts },
    unlock: data.unlock, lvup: data.lvup, player: p2,
  });
});
