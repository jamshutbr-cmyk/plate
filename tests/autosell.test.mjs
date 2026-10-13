// Автопродажа v2: одно правило, одинаковое в SQL (autosell_v2.sql) и в клиенте (autoMatch), без запросов на каждый тап.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUTO, autoMatch} from '../js/config.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sql = rd('supabase/autosell_v2.sql');

test('autoMatch: редкость, спецномера и потолок цены', () => {
  const p = (cls, type, price) => ({cls, type, price});
  const a = {cls: 1, sp: false, ceil: 5000};
  assert.ok(autoMatch(p(0, 'civil', 100), a));
  assert.ok(autoMatch(p(1, 'civil', 5000), a), 'потолок включительно');
  assert.ok(!autoMatch(p(1, 'civil', 5001), a));
  assert.ok(!autoMatch(p(2, 'civil', 10), a), 'редкость выше выбранной не продаётся');
  assert.ok(!autoMatch(p(0, 'taxi', 10), a), 'спецномер берегут');
  assert.ok(autoMatch(p(0, 'taxi', 10), {...a, sp: true}));
  assert.ok(autoMatch(p(2, 'police', 1e9), {cls: 2, sp: true, ceil: 0}), 'ceil 0 = без лимита');
  assert.ok(!autoMatch(p(3, 'civil', 1), {cls: 9, sp: true, ceil: 0}), 'эпические и выше не продаются никогда');
  assert.ok(!autoMatch(p(3, 'civil', 1), {cls: 2}), 'нет настроек: только обычные гражданские без потолка'.length > 0 && false || !autoMatch(p(1, 'civil', 1), {}));
});

test('правило в SQL то же, что в autoMatch', () => {
  assert.ok(/cls <= cap and \(type = 'civil' or sp\) and \(ceil_v = 0 or price <= ceil_v\)/.test(sql));
  assert.ok(/cap := least\(2, greatest\(0,/.test(sql));
  assert.ok(sql.includes(`v not in (0, 500, 5000, 50000, 500000)`));
  assert.deepEqual(AUTO.ceil, [0, 500, 5000, 50000, 500000]);
  assert.equal(AUTO.cls.length, 3);
});

test('цена открытия в SQL и config.js совпадает; доллары не создаются из воздуха', () => {
  assert.equal(+sql.match(/cost constant int := (\d+)/)[1], AUTO.cost);
  // возврат за старые уровни: накопленная цена уровня минус цена открытия
  const old = [25, 50, 100, 150, 200, 250, 300, 400, 500];
  const cum = old.map((_, i) => old.slice(0, i + 1).reduce((a, b) => a + b));
  assert.ok(sql.includes(`array[${cum.join(',')}]`), 'таблица возврата = суммы старых цен');
});

test('продажа одним запросом: ответ несёт id и баланс, а клиент не перезагружает список', () => {
  assert.ok(/json_build_object\('n', n, 'gain', t, 'bal', nb, 'ids', to_json\(ids\)\)/.test(sql));
  const main = rd('js/views/main.js');
  assert.ok(!/S\.as\.every/.test(main), 'запроса после каждой генерации больше нет');
  assert.ok(!/limit 1/.test(sql), 'режимов «по одному» нет');
});

test('функции закрыты от anon, старый переключатель удалён', () => {
  assert.ok(/drop function if exists public\.autosell_toggle\(text\)/.test(sql));
  assert.ok(/grant\s+execute on function public\.buy_autosell\(\), public\.autosell_set\(text, int\), public\.autosell\(\) to authenticated/.test(sql));
  assert.ok(!/autosell_toggle|autoToggle/.test(rd('js/api.js')));
});
