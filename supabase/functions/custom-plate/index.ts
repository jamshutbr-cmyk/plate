// Edge Function custom-plate: свой номер за рубли. Тело запроса: { action: 'quote' | 'buy', letters, digits, reg }.
//  quote → { quote: { plate, cost } } либо { error } (всегда 200, чтобы при наборе не сыпались ошибки в консоль)
//  buy   → { plate, cost, player: { balance } } либо { error } со статусом 400 / 402 (money) / 409 (full)
// Правила (формат, редкость, цена) считает только сервер: _shared/engine.ts → customPlate.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import { customPlate } from '../_shared/engine.ts';
import { loadRegions } from '../_shared/regions.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: au, error: ae } = await admin.auth.getUser(token);
  if (ae || !au.user) return json({ error: 'unauthorized' }, 401);
  const uid = au.user.id;

  let body: { action?: string; letters?: string; digits?: string; reg?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const buy = body.action === 'buy';

  const { data: pl } = await admin.from('players').select('country').eq('id', uid).single();
  if (!pl) return json({ error: 'no player' }, 404);

  const regs = (await loadRegions(admin))[pl.country];
  const res = customPlate(pl.country, String(body.letters ?? ''), String(body.digits ?? ''), String(body.reg ?? ''), regs);
  if ('error' in res) return json({ error: res.error }, buy ? 400 : 200);
  if (!buy) return json({ quote: { plate: res.plate, cost: res.cost } });

  const { data, error } = await admin.rpc('commit_custom_plate', { uid, pl: res.plate, cost: res.cost });
  if (error) {
    const m = error.message;
    if (m.includes('collection full')) return json({ error: 'full' }, 409);
    if (m.includes('not enough rub')) return json({ error: 'money' }, 402);
    return json({ error: 'server' }, 500);
  }
  const { data: p2 } = await admin.from('players').select('balance').eq('id', uid).single();
  return json({ plate: { ...res.plate, id: data.id, ts: data.ts }, cost: res.cost, player: p2 });
}

// Любой сбой (например, не загрузились регионы) отдаём JSON с CORS-заголовками: иначе браузер видит «сетевую» ошибку без причины
Deno.serve(async (req) => {
  try { return await handle(req); }
  catch (e) { console.error('custom-plate', e); return json({ error: 'server' }, 500); }
});
