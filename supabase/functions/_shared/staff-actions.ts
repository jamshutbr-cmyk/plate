// Обработчики штаба для tg-bot (рефералка и медиа). tg-bot в архиве не было, поэтому здесь чистые функции без привязки к фреймворку:
// подключите их в своём обработчике callback_query и команд. Роль проверяет SQL (staff_level по tg_id штаба) ДО действия:
// функции ref_review / media_review возвращают {err:'role'}, если прав нет. Здесь дополнительно ничего не решается.
//
//   в обработчике callback_query:
//     if (/^(ref|mp|nm):/.test(cb.data)) { const r = await staffCallback(admin, cb.data, cb.from.id); await answerCallbackQuery(cb.id, r.answer); if (r.edit) await editMessageText(...r.edit); }
//   в обработчике команд:
//     /media_stats, /media_queue, /ref_stats → staffCommand(admin, '/media_stats', from.id)
import { pointsKb } from './staffmsg.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;
const ERR: Record<string, string> = { role: 'Недостаточно прав', state: 'Уже обработано', point: 'Нужен пункт правил', decision: 'Неверное действие', account: 'Аккаунт не подтверждён', kind: 'Неизвестный тип' };
const KIND: Record<string, string> = { a: 'account', p: 'post', v: 'views' };

export async function staffCallback(admin: Admin, data: string, staffTg: number): Promise<{ answer: string; edit?: { text: string; reply_markup?: unknown } }> {
  const p = data.split(':');
  // Рефералка: ref:ok|no|ban:<id>
  if (p[0] === 'ref') {
    const dec = p[1], id = Number(p[2]);
    const { data: r } = await admin.rpc('ref_review', { p_ledger: id, p_decision: dec, p_staff: staffTg });
    if (r?.err) return { answer: ERR[r.err] || 'Ошибка' };
    return { answer: 'Готово', edit: { text: `Рефералка #${id}: ${dec === 'ok' ? 'принято' : dec === 'no' ? 'отклонено' : 'оба забанены'}` } };
  }
  // Именные номера: nm:ok|no:<id>
  if (p[0] === 'nm') {
    const id = Number(p[2]);
    const { data: r } = await admin.rpc('named_review', { p_id: id, p_decision: p[1], p_staff: staffTg });
    if (r?.err) return { answer: ERR[r.err] || 'Ошибка' };
    if (p[1] === 'ok') {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/media-named`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': Deno.env.get('CRON_SECRET')!, Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }, body: JSON.stringify({ id, player: r.player, body: r.body, reg: r.reg }) });
      if (!res.ok) return { answer: 'Одобрено, но номер не выдан: проверьте формат', edit: { text: `Именной #${id}: одобрен, выдача не удалась (${(await res.text()).slice(0, 80)})` } };
    }
    return { answer: 'Готово', edit: { text: `Именной #${id}: ${p[1] === 'ok' ? 'одобрен и выдан' : 'отклонён'}` } };
  }
  // Медиа: mp:ok|fix:<a|p|v>:<id>, mp:rej:<kind>:<id> (показать причины), mp:no:<kind>:<id>:<пункт>, mp:back:<kind>:<id>
  if (p[0] === 'mp') {
    const act = p[1], kind = KIND[p[2]], id = Number(p[3]);
    if (!kind) return { answer: ERR.kind };
    if (act === 'rej') return { answer: 'Выберите пункт', edit: { text: `Причина отказа (${kind} #${id}):`, reply_markup: pointsKb(p[2], id) } };
    if (act === 'back') return { answer: 'Отмена' };
    const decision = act === 'ok' ? 'ok' : act === 'fix' ? 'fix' : 'no';
    const { data: r } = await admin.rpc('media_review', { p_kind: kind, p_id: id, p_decision: decision, p_point: p[4] || null, p_staff: staffTg });
    if (r?.err) return { answer: ERR[r.err] || 'Ошибка' };
    return { answer: 'Готово', edit: { text: `Медиа ${kind} #${id}: ${decision === 'ok' ? 'принято' : decision === 'fix' ? 'на доработку' : 'отклонено, п. ' + p[4]}` } };
  }
  return { answer: 'Неизвестное действие' };
}

export async function staffCommand(admin: Admin, cmd: string, staffTg: number): Promise<string> {
  const { data: lv } = await admin.rpc('staff_level', { p_tg: staffTg });
  if (!lv || lv < 1) return 'Нет доступа';
  const n = (x: unknown) => new Intl.NumberFormat('ru-RU').format(Number(x || 0));
  if (cmd.startsWith('/media_stats')) {
    const { data: s } = await admin.rpc('media_stats');
    return `Медиа\nОчередь: аккаунты ${s.queue_accounts}, ролики ${s.queue_posts}, просмотры ${s.queue_views}\nАвторов: ${s.authors}\nВыплачено за месяц: ${n(s.paid_month)} МК\nПул: ${n(s.pool_used)} из ${n(s.pool)} МК, заморожено выплат: ${s.queued_payouts}`;
  }
  if (cmd.startsWith('/media_queue')) {
    const { data: q } = await admin.rpc('media_queue_list', { p_limit: 15 });
    const l = (a: { id: number }[]) => (a.length ? a.map((x) => '#' + x.id).join(', ') : '—');
    return `Очередь\nАккаунты: ${l(q.accounts)}\nРолики: ${l(q.posts)}\nПросмотры: ${l(q.views)}`;
  }
  if (cmd.startsWith('/ref_stats')) {
    const { data: s } = await admin.rpc('ref_stats');
    return `Рефералка\nРефералов: ${s.referrals}, активных: ${s.active}\nНа проверке: ${s.review}, в удержании: ${s.hold}\nВыдано сегодня: ${n(s.paid_today_rub)} ₽ из ${n(s.budget_rub)} ₽`;
  }
  return 'Неизвестная команда';
}
