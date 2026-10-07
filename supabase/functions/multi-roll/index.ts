// Edge Function multi-roll: тройная прокрутка.
// Вход: { n: 1|2|3 }. Проверяет пасс, генерирует n номеров, кладёт их в pending_rolls.
// Выход: { batch, plates } либо { error }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import { mk, feats, regionFee } from '../_shared/engine.ts';
import { loadRegions } from '../_shared/regions.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const COST = 3000; // совпадает с COST в _shared/engine.ts

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: au, error: ae } = await admin.auth.getUser(token);
  if (ae || !au.user) return json({ error: 'unauthorized' }, 401);
  const uid = au.user.id;

  const body = await req.json().catch(() => ({}));
  const n = Number(body.n);
  if (![1, 2, 3].includes(n)) return json({ error: 'bad count' }, 400);

  // пасс нужен для тройной прокрутки (и для одиночной — нет, одиночная работает как раньше)
  const { data: pass } = await admin.from('passes').select('expires_at').eq('owner', uid).maybeSingle();
  if (!pass || new Date(pass.expires_at) <= new Date()) return json({ error: 'no pass' }, 403);

  const { data: pl } = await admin.from('players').select('country, reg, luck').eq('id', uid).single();
  if (!pl) return json({ error: 'no player' }, 404);

  const regs = (await loadRegions(admin))[pl.country];
  const fee = regionFee(regs, pl.reg);                 // доплата за регион — один раз за пакет
  const cost = COST * n + fee;

  const plates: any[] = [];
  const fts: number[][] = [];
  let luck = pl.luck;
  for (let i = 0; i < n; i++) {
    // банк удачи применяется к каждому номеру отдельно, как в generate
    const tries = luck > 0 ? 3 : 1;
    let plate = mk({ country: pl.country, reg: pl.reg }, regs);
    for (let t = 1; t < tries; t++) {
      const alt = mk({ country: pl.country, reg: pl.reg }, regs);
      if (alt.price > plate.price) plate = alt;
    }
    if (luck > 0) luck--;
    plates.push(plate);
    fts.push(feats(plate));
  }

  const { data, error } = await admin.rpc('stage_rolls', { uid, pls: plates, ft: fts, cost });
  if (error) {
    const m = error.message;
    if (m.includes('not enough rub')) return json({ error: 'money' }, 402);
    if (m.includes('pending exists')) return json({ error: 'pending' }, 409);
    if (m.includes('no pass')) return json({ error: 'no pass' }, 403);
    return json({ error: 'server' }, 500);
  }

  if (pl.luck > 0) {
    // списываем удачу по одной за каждый номер пакета
    for (let i = 0; i < Math.min(n, pl.luck); i++) await admin.rpc('consume_luck', { uid });
  }

  return json({ batch: data.batch, plates, lvup: data.lvup, unlock: data.unlock });
});
