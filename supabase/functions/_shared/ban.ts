// Проверка бана для Edge Functions. banned_until: null — нет бана; 'infinity' (Postgres) — навсегда, дата — до этого момента.
// Date.parse('infinity') даёт NaN, поэтому NaN считаем активным баном.
export function banActive(until: string | null | undefined): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isNaN(t) || t > Date.now();
}
// Ответ клиенту: 403 { error: 'banned', reason, until }
export function bannedBody(reason: string | null, until: string | null) {
  return { error: 'banned', reason: reason ?? '', until };
}
// Запасная проверка для функций, которые сами не читают players
// deno-lint-ignore no-explicit-any
export async function banOf(admin: any, uid: string) {
  const { data } = await admin.from('players').select('banned_until, ban_reason').eq('id', uid).maybeSingle();
  return data && banActive(data.banned_until) ? bannedBody(data.ban_reason, data.banned_until) : null;
}
