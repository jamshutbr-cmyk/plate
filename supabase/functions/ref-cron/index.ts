// Edge Function ref-cron: раз в 15 минут (pg_net / планировщик Supabase). Заголовок x-cron-secret = секрет CRON_SECRET.
// Делает: 1) проверку подписки на канал у рефералов с наступающими выплатами; 2) пересчёт этапов (раз в час); 3) выдачу ref_release и media_release;
// 4) рассылку уведомлений игрокам (ref_outbox); 5) очередь штаба (проверки наград, аккаунты, ролики, просмотры, именные, просрочки) в чат STAFF_CHAT_ID.
// Секреты: BOT_TOKEN, CHANNEL, CRON_SECRET, STAFF_CHAT_ID (чат штаба; по ТЗ — админ-чат).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import { accountMsg, namedMsg, postMsg, refReviewMsg, viewsMsg } from '../_shared/staffmsg.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const BOT = Deno.env.get('BOT_TOKEN')!;
const tg = (m: string, b: Record<string, unknown>) => fetch(`https://api.telegram.org/bot${BOT}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
  const out: Record<string, unknown> = {};
  const channel = Deno.env.get('CHANNEL');
  // 1) подписка
  if (channel) {
    const { data: t } = await admin.rpc('ref_sub_targets', { p_limit: 150 });
    const rows: { player: string; ok: boolean }[] = [];
    for (const x of (t || []) as { player: string; tg: number }[]) {
      const r = await tg('getChatMember', { chat_id: channel, user_id: x.tg });
      if (r?.ok) { const st = r.result?.status; rows.push({ player: x.player, ok: ['creator', 'administrator', 'member'].includes(st) || (st === 'restricted' && !!r.result.is_member) }); }
      await sleep(40);   // ≈25 запросов в секунду
    }
    if (rows.length) await admin.rpc('ref_sub_set', { p_rows: rows });
    out.sub = rows.length;
  }
  // 2) пересчёт этапов: не чаще раза в час (минута часа < 15)
  if (new Date().getUTCMinutes() < 15) { const { data } = await admin.rpc('ref_recount', {}); out.recount = data; }
  // 3) выдача
  out.ref_paid = (await admin.rpc('ref_release', { p_limit: 300 })).data;
  out.media_paid = (await admin.rpc('media_release', { p_limit: 300 })).data;
  // 4) уведомления игрокам
  const { data: ob } = await admin.rpc('ref_outbox_take', { p_limit: 60 });
  let sent = 0;
  for (const m of (ob || []) as { tg_id: number; body: string }[]) { const r = await tg('sendMessage', { chat_id: m.tg_id, text: m.body }); if (r?.ok) sent++; await sleep(40); }
  out.dm = sent;
  // 5) очередь штаба
  const chat = Deno.env.get('STAFF_CHAT_ID');
  if (chat) {
    const send = (m: { text: string; reply_markup: unknown }) => tg('sendMessage', { chat_id: chat, parse_mode: 'HTML', disable_web_page_preview: true, ...m });
    const rv = (await admin.rpc('ref_review_take', { p_limit: 20 })).data;
    for (const r of rv?.review || []) await send(refReviewMsg(r));
    for (const a of rv?.alerts || []) await tg('sendMessage', { chat_id: chat, text: `Рефералка: ${a.player || ''} — ${a.kind === 'banned3' ? `забанено рефералов за 30 дней: ${a.data?.n}. Награды заморожены, нужна проверка штаба.` : a.kind}` });
    const q = (await admin.rpc('media_queue_take', { p_limit: 20 })).data;
    for (const a of q?.accounts || []) await send(accountMsg(a));
    for (const p of q?.posts || []) await send(postMsg(p));
    for (const v of q?.views || []) {
      const { data: s } = await admin.storage.from('media-proofs').createSignedUrl(v.proof, 3600);   // ссылка на скриншот живёт час
      await send(viewsMsg(v, s?.signedUrl));
    }
    for (const n of q?.named || []) await send(namedMsg(n));
    const od = (await admin.rpc('media_queue_overdue')).data;
    const cnt = (od?.accounts?.length || 0) + (od?.posts?.length || 0) + (od?.views?.length || 0);
    if (cnt) await tg('sendMessage', { chat_id: chat, text: `Медиа: просрочен срок проверки (${cnt}). Аккаунты: ${(od.accounts || []).join(', ') || '—'}; ролики: ${(od.posts || []).join(', ') || '—'}; просмотры: ${(od.views || []).join(', ') || '—'}. Нужен старший модератор.` });
  }
  return json({ ok: true, ...out });
});
