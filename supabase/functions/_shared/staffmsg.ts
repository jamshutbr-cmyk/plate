// Сообщения штабу и игрокам для рефералки и медиа-программы. callback_data не длиннее 64 байт:
//   ref:ok:<id> | ref:no:<id> | ref:ban:<id>
//   mp:ok:<kind>:<id> | mp:fix:<kind>:<id> | mp:no:<kind>:<id>:<пункт>   (kind: a = аккаунт, p = ролик, v = просмотры)
//   nm:ok:<id> | nm:no:<id>
export type Btn = { text: string; callback_data: string };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n);
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export const POINTS: [string, string][] = [
  ['19.3', 'Накрутка'], ['19.4', 'Подмена скриншота'], ['19.5', 'Чужой контент'], ['19.6', 'Нарушение правил'], ['19.12', 'Обход лимитов'],
];
export const pointsKb = (kind: string, id: number) => ({ inline_keyboard: [
  ...POINTS.map(([p, t]) => [{ text: `${p} ${t}`, callback_data: `mp:no:${kind}:${id}:${p}` }]), [{ text: 'Отмена', callback_data: `mp:back:${kind}:${id}` }] ] });

export function refReviewMsg(r: any) {
  const flags = (r.flags || []).join(', ') || 'нет';
  const rw = r.reward || {};
  return {
    text: `<b>Реферал: проверка награды #${r.id}</b>\nПригласил: ${esc(r.referrer)}\nПриглашённый: ${esc(r.referee)}\nЭтап: ${esc(r.kind)}\nНаграда: ${fmt(rw.rub || 0)} ₽${rw.luck ? ` · ${rw.luck} прокрутов` : ''}\nФлаги: ${esc(flags)}`,
    reply_markup: { inline_keyboard: [[{ text: 'Принять', callback_data: `ref:ok:${r.id}` }, { text: 'Отклонить', callback_data: `ref:no:${r.id}` }], [{ text: 'Забанить обоих', callback_data: `ref:ban:${r.id}` }]] },
  };
}
export function accountMsg(a: any) {
  return { text: `<b>Медиа: аккаунт #${a.id}</b>\nАвтор: ${esc(a.nick)} · уровень ${a.level ?? 0}\n${esc(a.platform)}: ${esc(a.url)}\nКод в описании: <code>${esc(a.code)}</code>\nСрок: до ${when(a.due)}`,
    reply_markup: { inline_keyboard: [[{ text: 'Принять', callback_data: `mp:ok:a:${a.id}` }, { text: 'Доработка', callback_data: `mp:fix:a:${a.id}` }, { text: 'Отклонить', callback_data: `mp:rej:a:${a.id}` }]] } };
}
export function postMsg(p: any) {
  return { text: `<b>Медиа: ролик #${p.id}</b>\nАвтор: ${esc(p.nick)} · уровень ${p.level ?? 0}\n${esc(p.url)}\nСрок: до ${when(p.due)}\nПроверьте: геймплей ≥5 с, название, реф-код в описании, длительность от 15 с.`,
    reply_markup: { inline_keyboard: [[{ text: 'Принять', callback_data: `mp:ok:p:${p.id}` }, { text: 'Доработка', callback_data: `mp:fix:p:${p.id}` }, { text: 'Отклонить', callback_data: `mp:rej:p:${p.id}` }]] } };
}
export function viewsMsg(v: any, proofUrl?: string) {
  return { text: `<b>Медиа: просмотры #${v.id}</b>\nАвтор: ${esc(v.nick)}\nРолик: ${esc(v.post)}\nЗаявлено: ${fmt(v.views)}${v.senior ? ' (нужен старший модератор)' : ''}\n${proofUrl ? `Скриншот: ${esc(proofUrl)}\n` : ''}Срок: до ${when(v.due)}`,
    reply_markup: { inline_keyboard: [[{ text: 'Принять', callback_data: `mp:ok:v:${v.id}` }, { text: 'Доработка', callback_data: `mp:fix:v:${v.id}` }, { text: 'Отклонить', callback_data: `mp:rej:v:${v.id}` }]] } };
}
export function namedMsg(n: any) {
  return { text: `<b>Именной номер #${n.id}</b> (${n.src === 'ref' ? '500 друзей' : 'Топ-медиа'})\nИгрок: ${esc(n.nick)}\nЗапрос: <code>${esc(n.body)}</code> ${esc(n.reg)}\nПроверьте допустимость и правила.`,
    reply_markup: { inline_keyboard: [[{ text: 'Одобрить', callback_data: `nm:ok:${n.id}` }, { text: 'Отклонить', callback_data: `nm:no:${n.id}` }]] } };
}
