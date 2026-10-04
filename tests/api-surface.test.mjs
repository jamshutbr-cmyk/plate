// Каждый вызов api.имя(...) в экранах и модулях должен существовать в js/api.js.
// Иначе действие падает TypeError и игрок видит «Нет связи с сервером» (так было с setGenPrefs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('../js/', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(root).filter((f) => f.endsWith('.js'));

test('все api.* из экранов определены в api.js', () => {
  const api = readFileSync(join(root, 'api.js'), 'utf8');
  const defined = new Set([...api.matchAll(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm)].map((m) => m[1]));
  const missing = [];
  for (const f of files) {
    if (f.endsWith('/api.js')) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/\bapi\.(\w+)/g)) {
      if (m[1] !== 'js' && !defined.has(m[1])) missing.push(`${f.replace(root, '')}: api.${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
