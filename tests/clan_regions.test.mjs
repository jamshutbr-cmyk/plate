// Захват регионов и клановый магазин: сверка config.js с clan_regions.sql, бонус в движке, инварианты стока денег.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLAN_REG, CLAN_SHOP, itemOf} from '../js/config.js';
import * as srv from '../supabase/functions/_shared/engine.ts';
import {RR, RICH} from '../js/data/regions.js';

const sql = readFileSync(new URL('../supabase/clan_regions.sql', import.meta.url), 'utf8');
const fn = (name) => {
  const i = sql.indexOf(`function public.${name}(`);
  assert.ok(i >= 0, `нет функции ${name}`);
  return sql.slice(i, sql.indexOf('$$;', sql.indexOf('$$', i + 20) + 2) + 3);
};

test('константы торгов: config.js и clan_regions.sql совпадают', () => {
  assert.ok(sql.includes(`bid_min constant bigint := ${CLAN_REG.bidMin}`));
  assert.ok(sql.includes(`else ${CLAN_REG.def} end`), 'бонус защитника');
  assert.equal(srv.REGION_BOOST, CLAN_REG.boost);
});

test('каталог клановых товаров совпадает с таблицей в SQL', () => {
  for (const it of CLAN_SHOP) {
    const m = sql.match(new RegExp(`\\('${it.id}',\\s*'(\\w+)',\\s*(\\d+),\\s*(\\d+)\\)`));
    assert.ok(m, `нет ${it.id} в SQL`);
    assert.equal(m[1], it.slot, it.id);
    assert.equal(Number(m[2]), it.p, it.id);
    assert.equal(Number(m[3]), it.lvl, it.id);
    assert.match(it.id, it.slot == 'frame' ? /^cf_/ : it.slot == 'fx' ? /^cx_/ : /^ct_/);
  }
  assert.equal((sql.match(/^\s+\('c[fxt]_\w+'/gm) || []).length, CLAN_SHOP.length);
  assert.ok(CLAN_SHOP.every((i) => i.lvl >= 1 && i.lvl <= 5 && i.p > 0));
  assert.equal(itemOf('ct_vet').slot, 'title');
  assert.ok(itemOf('ct_vet').c);
});

test('клановые титулы начинаются с ct_ (на этом держатся триггер и get_styles)', () => {
  assert.ok(sql.includes("like 'ct\\_%'"));
  for (const i of CLAN_SHOP.filter((x) => x.slot == 'title')) assert.ok(i.id.startsWith('ct_'));
});

test('деньги только сгорают: ставка и покупка списывают из казны, ничего не начисляют', () => {
  assert.ok(!/balance\s*=\s*balance\s*\+/.test(sql));
  assert.ok(/treasury = treasury - p_amount/.test(fn('clan_region_bid')));
  assert.ok(/treasury = treasury - it\.price/.test(fn('clan_shop_buy')));
  for (const f of ['clan_region_bid', 'clan_shop_buy', 'clan_set_style', 'clan_equip_title'])
    assert.ok(/from players where id = auth\.uid\(\) for update/.test(fn(f)), `${f}: сначала игрок`);
  for (const f of ['clan_region_bid', 'clan_shop_buy']) {
    const t = fn(f);
    assert.ok(t.indexOf('from players') < t.indexOf('from clans where id = m.clan_id for update'), `${f}: порядок блокировок`);
  }
});

test('права: игрок не может звать служебные функции', () => {
  assert.ok(/revoke execute on function\s+public\.clan_regions_settle\(\), public\.clan_regions_held\(bigint, int\), public\.clan_region_boost\(uuid\), public\.clan_title_clear\(\)\s+from public, anon, authenticated/.test(sql));
  assert.ok(/grant execute on function public\.clan_regions_settle\(\), public\.clan_regions_held\(bigint, int\), public\.clan_region_boost\(uuid\) to service_role/.test(sql));
});

test('движок: регион клана выпадает в разы чаще, остальное без изменений', () => {
  const regs = Object.keys(RR).map((code) => ({code, name: RR[code][0], mult: RR[code][1], rich: RICH.has(code)}));
  const n = 20000, share = (boost) => {
    let k = 0;
    for (let i = 0; i < n; i++) if (srv.mk({country: 'RU', reg: '', boost}, regs).rn == 'Краснодарский край') k++;
    return k / n;
  };
  const base = share([]), boosted = share(['Краснодарский край']);
  assert.ok(boosted > base * 2, `${base} -> ${boosted}`);
  // выбранный игроком регион бонус не трогает
  for (let i = 0; i < 200; i++) assert.equal(srv.mk({country: 'RU', reg: 'Татарстан', boost: ['Москва']}, regs).rn, 'Татарстан');
});

test('Edge Functions спрашивают бонус у сервера и не падают без него', () => {
  for (const f of ['generate', 'multi-roll']) {
    const t = readFileSync(new URL(`../supabase/functions/${f}/index.ts`, import.meta.url), 'utf8');
    assert.ok(t.includes("rpc('clan_region_boost'") && t.includes('?? []'), f);
    assert.ok(!/mk\(\{ country: pl\.country, reg: pl\.reg \}/.test(t), `${f}: каждый mk получает boost`);
  }
});
