// Серверный движок генерации. Порт js/engine.js + js/data/regions.js; правила должны совпадать с клиентом.
// Чистые функции без доступа к БД: регионы и настройки игрока передаются снаружи (тестируется в Node).

export const RAR_M = [1, 11.55, 661.2, 9955, 242550];
// k — тип, p — шанс в % (сумма строго 100), m — множитель цены, c — страны, где тип выпадает.
// В Беларуси выпадают только civil, taxi, police и transit: для страны шансы берутся только у её типов и пересчитываются на их сумму.
// Зеркало: TYPES в js/config.js (там ещё названия n), это сверяет tests/types.test.mjs.
export const TYPES = [
  { k: 'civil', p: 92.86, m: 1, c: ['RU', 'BY'] },
  { k: 'taxi', p: 4, m: 24, c: ['RU', 'BY'] },
  { k: 'police', p: 1, m: 50, c: ['RU', 'BY'] },
  { k: 'transit', p: 2, m: 0.5, c: ['RU', 'BY'] },
  { k: 'military', p: 0.07, m: 80, c: ['RU'] },
  { k: 'diplomat', p: 0.06, m: 120, c: ['RU'] },
  { k: 'retro', p: 0.01, m: 200, c: ['RU'] },
];
const RU_L = 'АВЕКМНОРСТУХ';
const BY_L = 'ABEIKMHOPCTX';
export const RU_AVG = 1.956;

// ---- магазин (баланс; клиент зеркалит REGION_FEE_BASE в js/config.js, это сверяет tests/shop.test.mjs) ----
export const COST = 3000;            // базовая цена прокрута
export const REGION_FEE_BASE = 3000; // доплата за выбранный регион: BASE * mult² (округление до 100)

export type Region = { code: string; name: string; mult: number; rich: boolean };
export type Prefs = { country: 'RU' | 'BY'; reg: string };
export type Plate = {
  country: string; type: string; main: string; reg: string; rn: string; cls: number;
  mu: number[]; price: number;
};

// Криптослучайность: сервер не должен использовать предсказуемый Math.random
export function rnd(n: number): number {
  const b = new Uint32Array(1);
  const lim = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(b); while (b[0] >= lim);
  return b[0] % n;
}
const rf = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 0x100000000; };
const pick = <T>(a: ArrayLike<T>): T => a[rnd(a.length)];

export function classify(d: string, ls: string): { cls: number; kd: number } {
  const f: Record<string, number> = {};
  for (const c of d) f[c] = (f[c] || 0) + 1;
  const v = Object.values(f), m = Math.max(...v), pairs = v.filter((x) => x == 2).length, a = [...d].map(Number);
  let seq = false;
  for (let i = 0; i + 2 < a.length; i++) {
    const x = a[i], y = a[i + 1], z = a[i + 2];
    if ((y == x + 1 && z == y + 1) || (y == x - 1 && z == y - 1)) seq = true;
  }
  const dl = m == 4 ? 4 : m == 3 ? 3 : (m == 2 && pairs == 2) ? 2 : m == 2 ? 1 : seq ? 2 : 0;
  const g: Record<string, number> = {};
  for (const c of ls) g[c] = (g[c] || 0) + 1;
  const lm = Math.max(...Object.values(g));
  const ll = ls.length == 2 ? (lm == 2 ? 1 : 0) : (lm == 3 ? 2 : lm == 2 ? 1 : 0), t = dl + ll;
  return { cls: t <= 0 ? 0 : t == 1 ? 1 : t <= 3 ? 2 : t == 4 ? 3 : 4, kd: +Object.keys(f).find((k) => f[k] == m)! };
}

// ---- регионы ----
function regW(regs: Region[], c: string, reg: string): [Region, number][] {
  if (reg) {
    const f = regs.filter((r) => r.name == reg);
    if (f.length) return f.map((r) => [r, 1]);
  }
  return regs.map((r) => [r, r.rich || c != 'RU' ? 3 : 1]);
}
const regSel = (regs: Region[], reg: string) => !!reg && regs.some((r) => r.name == reg);
function regRaw(regs: Region[], c: string): number {
  const w = regs.map((r) => [r, r.rich || c != 'RU' ? 3 : 1] as [Region, number]);
  return w.reduce((x, [r, v]) => x + r.mult * v, 0) / w.reduce((x, y) => x + y[1], 0);
}
const regNorm = (regs: Region[], c: string) => (c == 'RU' ? RU_AVG / regRaw(regs, 'RU') : 1);
const regAvg = (regs: Region[], c: string) => (c == 'RU' ? RU_AVG : regRaw(regs, c));
function pickReg(regs: Region[], c: string, reg: string): Region {
  const w = regW(regs, c, reg);
  let x = rf() * w.reduce((a, b) => a + b[1], 0);
  for (const [r, v] of w) { x -= v; if (x < 0) return r; }
  return w[0][0];
}

export function mk(prefs: Prefs, allRegions: Region[]): Plate {
  const country = prefs.country, regs = allRegions;   // regs уже отфильтрованы по стране вызывающим
  const types = TYPES.filter((T) => T.c.includes(country));   // типы этой страны (в Беларуси только civil/taxi/police/transit)
  const tot = types.reduce((a, b) => a + b.p, 0);
  let x = rf() * tot, t = types[0], acc = 0;
  for (const T of types) { acc += T.p; if (x < acc) { t = T; break; } }
  const ru = country == 'RU', k = t.k;
  // Сколько цифр и букв и как они складываются в main. Беларусь: у всех типов один формат «1234 AB-».
  // military/diplomat/retro есть только в России, у каждого свой формат (и у них нет блока региона на плашке).
  const nd = !ru ? 4 : k == 'military' || k == 'retro' ? 4 : 3;
  const nl = !ru ? 2 : k == 'taxi' || k == 'military' ? 2 : k == 'diplomat' ? 0 : 3;
  let d: string;
  do d = Array.from({ length: nd }, () => rnd(10)).join(''); while (/^0+$/.test(d));
  const ls = Array.from({ length: nl }, () => pick(ru ? RU_L : BY_L)).join('');
  // Диплом: два знака кода страны — случайные цифры. Классифицируем по ним (как по «буквам»), фиксированные «CD» в classify не передаём.
  const cc = k == 'diplomat' ? String(1 + rnd(99)).padStart(2, '0') : '';
  const main = !ru ? d + ' ' + ls + '-'
    : k == 'taxi' ? ls + ' ' + d
    : k == 'military' ? d + ' ' + ls
    : k == 'diplomat' ? d + ' CD ' + cc
    : k == 'retro' ? d.slice(0, 2) + '-' + d.slice(2) + ' ' + ls
    : ls[0] + d + ls.slice(1);   // civil, police, transit
  const r = pickReg(regs, country, prefs.reg), { cls, kd } = classify(d, k == 'diplomat' ? cc : ls);
  const combo = RAR_M[cls], f = cls ? 1 + kd / 9 * .6 : 1;
  const rg = regSel(regs, prefs.reg) ? regAvg(regs, country) : r.mult * regNorm(regs, country);
  return {
    country, type: k, main, reg: r.code, rn: r.name, cls,
    mu: [combo, f, rg, t.m], price: Math.round(100 * combo * f * rg * t.m),
  };
}

export function feats(p: Pick<Plate, 'main' | 'reg' | 'type'>): number[] {
  const d = p.main.replace(/\D/g, ''), l = p.main.replace(/[\d\s-]/g, ''), r = (x: string) => [...x].reverse().join(''), o: number[] = [];
  if (new Set(d).size < d.length) o.push(0);
  if (new Set(l).size < l.length) o.push(1);
  if (d.length > 2 && d == r(d)) o.push(2);
  if (l.length > 1 && l == r(l)) o.push(3);
  if (/^[1-9]0+$/.test(d)) o.push(4);
  if (p.reg.length > 1 && d.includes(p.reg)) o.push(5);
  if (['777', '888', '999', '555', '007'].includes(d)) o.push(6);
  if (/^0+[1-9]$/.test(d)) o.push(7);
  o.push(({ civil: 8, taxi: 9, police: 10, transit: 11, military: 12, diplomat: 13, retro: 14 } as Record<string, number>)[p.type]);
  return o;
}

// ---------- платный выбор региона ----------
// Средний множитель региона по названию (у региона может быть несколько кодов). 0, если региона нет.
export function regionMult(regs: Region[], reg: string): number {
  const f = reg ? regs.filter((r) => r.name == reg) : [];
  return f.length ? f.reduce((a, r) => a + r.mult, 0) / f.length : 0;
}
// Доплата к каждому прокруту с выбранным регионом. Без региона — 0.
export function regionFee(regs: Region[], reg: string): number {
  const m = regionMult(regs, reg);
  return m ? Math.round((REGION_FEE_BASE * m * m) / 100) * 100 : 0;
}
