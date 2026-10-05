// Общий код для tests/balance-sim.mjs и tests/types.test.mjs: регионы из seed_regions.sql и точное ожидание цены.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// регионы из seed_regions.sql: ('RU','10','Карелия',1,false),
export function seedRegions() {
  const sql = readFileSync(path.join(here, '../supabase/seed_regions.sql'), 'utf8');
  const REG = {RU: [], BY: []};
  for (const m of sql.matchAll(/\('(RU|BY)','([^']+)','([^']+)',([\d.]+),(true|false)\)/g))
    REG[m[1]].push({code: m[2], name: m[3], mult: +m[4], rich: m[5] == 'true'});
  return REG;
}

export const allowed = (srv, c) => srv.TYPES.filter((t) => !t.c || t.c.includes(c));
export const rawAvg = (REG, c) => { const w = REG[c].map((r) => [r, r.rich || c != 'RU' ? 3 : 1]); return w.reduce((a, [r, v]) => a + r.mult * v, 0) / w.reduce((a, [, v]) => a + v, 0); };
export const norm = (srv, REG, c) => (c == 'RU' ? srv.RU_AVG / rawAvg(REG, 'RU') : 1);

// Точное мат. ожидание combo*f для формата (nd цифр, nl «букв» из алфавита A) — перебором, без шума симуляции.
// Редкость = цифры (dl) + буквы (ll), они независимы, поэтому перебираем цифры и три образца букв с известными вероятностями.
export function exactCF(srv, nd, nl, A) {
  const p = nl == 2 ? [1 - 1 / A, 1 / A, 0] : [(A - 1) * (A - 2) / (A * A), 3 * (A - 1) / (A * A), 1 / (A * A)];
  const rep = nl == 2 ? ['АВ', 'АА', 'АА'] : ['АВС', 'ААВ', 'ААА'];
  let e = 0, n = 0;
  for (let i = 1; i < 10 ** nd; i++) {            // цифры не бывают «все нули»
    const d = String(i).padStart(nd, '0'); n++;
    for (let k = 0; k < 3; k++) if (p[k]) { const r = srv.classify(d, rep[k]); e += p[k] * srv.RAR_M[r.cls] * (r.cls ? 1 + r.kd / 9 * .6 : 1); }
  }
  return e / n;
}
// формат каждого типа: [цифр, «букв», размер алфавита]. Совпадает с mk() в _shared/engine.ts
export const FMT = (c, k) => c == 'BY' ? [4, 2, 12]
  : ({taxi: [3, 2, 12], military: [4, 2, 12], diplomat: [3, 2, 10], retro: [4, 3, 12]}[k] || [3, 3, 12]);
export function exactMean(srv, REG, c) {
  const types = allowed(srv, c), tot = types.reduce((a, t) => a + t.p, 0);
  const avgRg = c == 'RU' ? srv.RU_AVG : rawAvg(REG, c);
  return 100 * avgRg * types.reduce((a, t) => a + t.p / tot * t.m * exactCF(srv, ...FMT(c, t.k)), 0);
}
