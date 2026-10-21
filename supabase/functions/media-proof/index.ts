// Edge Function media-proof: игрок присылает скриншот статистики (jpeg, png, webp, до 3 МБ) для заявки на просмотры.
// Вход: multipart/form-data, поле file. Выход: { path } — имя файла (uuid.расширение) в закрытом бакете media-proofs; его нужно передать в media_views_claim(p_proof).
// Бакет создать вручную: Storage → New bucket → media-proofs, Public = off. Штабу ссылка выдаётся подписанной и ограниченной по времени (ref-cron).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';
import { banOf } from '../_shared/ban.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX = 3 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const { data: au, error } = await admin.auth.getUser(token);
    if (error || !au.user) return json({ error: 'unauthorized' }, 401);
    const bn = await banOf(admin, au.user.id);
    if (bn) return json(bn, 403);
    const form = await req.formData().catch(() => null);
    const f = form?.get('file');
    if (!(f instanceof File)) return json({ error: 'no file' }, 400);
    const ext = TYPES[f.type];
    if (!ext) return json({ error: 'type' }, 415);
    if (f.size > MAX || f.size === 0) return json({ error: 'size' }, 413);
    const buf = new Uint8Array(await f.arrayBuffer());
    // Проверка по сигнатуре, а не только по заявленному типу
    const ok = (ext === 'jpg' && buf[0] === 0xff && buf[1] === 0xd8) || (ext === 'png' && buf[0] === 0x89 && buf[1] === 0x50) || (ext === 'webp' && buf[8] === 0x57 && buf[9] === 0x45);
    if (!ok) return json({ error: 'type' }, 415);
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await admin.storage.from('media-proofs').upload(path, buf, { contentType: f.type, upsert: false });
    if (up.error) return json({ error: 'server' }, 500);
    return json({ path });
  } catch (e) { console.error('media-proof', e); return json({ error: 'server' }, 500); }
});
