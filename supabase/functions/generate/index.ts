// Edge Function generate: выдаёт игроку номер. Клиент передаёт только JWT — всё остальное считает сервер.
// Выход: { plate, unlock: 'cls'|'type'|null, lvup, player: { balance, usd, xp, lvl } } либо { error }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import { mk, feats, type Region } from '../_shared/engine.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// Справочник регионов кэшируется на время жизни инстанса функции
let regCache: Record<string, Region[]> | null = null;
let regAt = 0;
async function regions(): Promise<Record<string, Region[]>> {
  if (regCache && Date.now() - regAt < 10 * 60_000) return regCache;
  const { data, error } = await admin.from('regions').select('country, code, name, mult, rich');
  if (error || !data?.length) throw new Error('regions');
  const m: Record<string, Region[]> = { RU: [], BY: [] };
  for (const r of data) m[r.country].push({ code: r.code, name: r.name, mult: Number(r.mult), rich: r.rich });
  regCache = m; regAt = Date.now();
  return m;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: au, error: ae } = await admin.auth.getUser(token);
  if (ae || !au.user) return json({ error: 'unauthorized' }, 401);
  const uid = au.user.id;

  const { data: pl } = await admin.from('players').select('country, reg').eq('id', uid).single();
  if (!pl) return json({ error: 'no player' }, 404);

  const regs = (await regions())[pl.country];
  const plate = mk({ country: pl.country, reg: pl.reg }, regs);
  const { data, error } = await admin.rpc('commit_plate', { uid, pl: plate, ft: feats(plate) });
  if (error) {
    const m = error.message;
    if (m.includes('collection full')) return json({ error: 'full' }, 409);
    if (m.includes('not enough rub')) return json({ error: 'money' }, 402);
    return json({ error: 'server' }, 500);
  }
  const { data: p2 } = await admin.from('players').select('balance, usd, xp, lvl, stats, seen').eq('id', uid).single();
  return json({
    plate: { ...plate, id: data.id, ts: data.ts },
    unlock: data.unlock, lvup: data.lvup, player: p2,
  });
});
