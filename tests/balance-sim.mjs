// Симуляция баланса: миллион прокрутов через серверный mk() с регионами из supabase/seed_regions.sql.
// Это НЕ тест (имя без .test.), npm test её не запускает. Запуск:
//   node --experimental-strip-types --no-warnings tests/balance-sim.mjs [путь/к/engine.ts] [число прокрутов]
// Для сравнения «до/после» передайте путь к старому движку (например, из git).
import * as lib from './balance-lib.mjs';
import {seedRegions} from './balance-lib.mjs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(process.argv[2] || path.join(here, '../supabase/functions/_shared/engine.ts'));
const N = +(process.argv[3] || 1e6);
const srv = await import(pathToFileURL(enginePath).href);

const REG = seedRegions();
const allowed = (c) => lib.allowed(srv, c), rawAvg = (c) => lib.rawAvg(REG, c), norm = (c) => lib.norm(srv, REG, c), exactMean = (c) => lib.exactMean(srv, REG, c);

const fmt = (x) => x.toLocaleString('ru-RU', {maximumFractionDigits: 0});
const out = {};
for (const c of ['RU', 'BY']) {
  const regs = REG[c], types = allowed(c), tot = types.reduce((a, t) => a + t.p, 0);
  const prices = new Float64Array(N), cnt = {}; let sum = 0, over = 0, max = 0, min = Infinity;
  for (let i = 0; i < N; i++) {
    const p = srv.mk({country: c, reg: ''}, regs), v = p.price;
    prices[i] = v; sum += v; if (v > 1e6) over++; if (v > max) max = v; if (v < min) min = v;
    cnt[p.type] = (cnt[p.type] || 0) + 1;
  }
  prices.sort();
  const rg = regs.map((r) => r.mult * norm(c)), maxM = Math.max(...types.map((t) => t.m)), minM = Math.min(...types.map((t) => t.m));
  const theoMax = 100 * srv.RAR_M[4] * 1.6 * Math.max(...rg) * maxM, theoMin = 100 * 1 * 1 * Math.min(...rg) * minM;
  const avgM = types.reduce((a, t) => a + t.p * t.m, 0) / tot;
  out[c] = {exact: exactMean(c), mean: sum / N, median: prices[N >> 1], share1m: over / N * 100, max, min, theoMax, theoMin, avgM, cnt};
  console.log(`\n== ${c}, ${fmt(N)} прокрутов ==`);
  console.log(`средняя цена        ${fmt(sum / N)} ₽   (точное ожидание ${fmt(out[c].exact)} ₽)`);
  console.log(`медиана             ${fmt(prices[N >> 1])} ₽`);
  console.log(`дороже 1 000 000 ₽  ${(over / N * 100).toFixed(3)}%`);
  console.log(`макс. в симуляции   ${fmt(max)} ₽   мин. ${fmt(min)} ₽`);
  console.log(`макс. возможная     ${fmt(Math.round(theoMax))} ₽   мин. возможная ${fmt(Math.round(theoMin))} ₽`);
  console.log(`средний множитель типа ${avgM.toFixed(4)}`);
  console.log('доли типов: ' + Object.entries(cnt).map(([k, v]) => `${k} ${(v / N * 100).toFixed(2)}%`).join(', '));
}
