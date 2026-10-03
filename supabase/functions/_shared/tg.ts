// Проверка подписи Telegram Mini App initData: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(msg));
}
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type TgUser = { id: number; first_name?: string; username?: string; photo_url?: string };

/** Возвращает пользователя Telegram или null, если подпись неверна / данные устарели. */
export async function verifyInitData(initData: string, botToken: string, maxAgeSec = 86400, now = Date.now()): Promise<TgUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const calc = hex(await hmac(secret, dcs));
  if (!safeEq(calc, hash)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null;
  try {
    const u = JSON.parse(params.get('user') || '');
    return typeof u.id === 'number' ? u : null;
  } catch { return null; }
}

/** Детерминированный пароль игрока: HMAC(pepper, tg_id). Pepper лежит только в секретах функции. */
export async function playerPassword(tgId: number, pepper: string): Promise<string> {
  return hex(await hmac(enc.encode(pepper), 'tg:' + tgId));
}
