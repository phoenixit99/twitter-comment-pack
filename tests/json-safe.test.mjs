import test from 'node:test';
import assert from 'node:assert';
import { parseJsonSafe } from '../src/lib/json-safe.mjs';

test('parseJsonSafe keeps long unquoted IDs exact', () => {
  const cfg = parseJsonSafe('{"listIds": [2104036545699434815, "2093176214320206077"], "n": 15, "x": 1.5}');
  assert.deepStrictEqual(cfg.listIds, ['2104036545699434815', '2093176214320206077']);
  assert.strictEqual(cfg.n, 15);
  assert.strictEqual(cfg.x, 1.5);
});

test('parseJsonSafe leaves numbers inside strings alone', () => {
  const cfg = parseJsonSafe('{"note": "id 2104036545699434815 here", "id": 2104036545699434815}');
  assert.strictEqual(cfg.note, 'id 2104036545699434815 here');
  assert.strictEqual(cfg.id, '2104036545699434815');
});
