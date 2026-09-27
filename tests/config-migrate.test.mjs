import test from 'node:test';
import assert from 'node:assert';
import { migrateConfig } from '../src/lib/config-migrate.mjs';
import { getPillars, pickPillar } from '../src/lib/content-plan.mjs';

const oldE = {
  mode: 'E',
  modeB: { ownerUsername: '@Robert' },
  modeE: { listIds: ['L1', 'L2'], topics: ['BTC'], schedule: { slots: [] }, maxRetries: 3 },
};

test('adds new Mode E keys from legacy config without mutating input', () => {
  const before = JSON.stringify(oldE);
  const { cfg, added } = migrateConfig(oldE);
  assert.strictEqual(JSON.stringify(oldE), before);
  assert.deepStrictEqual(added, ['modeE.ownUsername', 'modeE.pillars', 'modeE.reuseSourceMedia', 'modeE.replyBack', 'modeE.autoTune']);
  assert.strictEqual(cfg.modeE.ownUsername, 'Robert');
  assert.deepStrictEqual(cfg.modeE.pillars[0].listIds, ['L1', 'L2']);
  assert.deepStrictEqual(cfg.modeE.pillars[0].topics, ['BTC']);
  assert.strictEqual(cfg.modeE.pillars[1].weight, 0);
  assert.strictEqual(cfg.modeE.replyBack.enabled, false);
  assert.strictEqual(cfg.modeE.autoTune.enabled, false);
  assert.strictEqual(cfg.modeE.maxRetries, 3);
});

test('migrated legacy config keeps posting crypto only until ai_tech is configured', () => {
  const { cfg } = migrateConfig(oldE);
  for (let i = 0; i < 20; i++) assert.strictEqual(pickPillar(cfg, 'x', Math.random).name, 'crypto');
  assert.deepStrictEqual(getPillars(cfg)[0].listIds, ['L1', 'L2']);
});

test('never overwrites user values; fills only missing sub-keys; idempotent', () => {
  const custom = { mode: 'E', modeE: { ownUsername: 'me', pillars: [{ name: 'x' }], replyBack: { enabled: true, maxPerHour: 3 } } };
  const { cfg, added } = migrateConfig(custom);
  assert.deepStrictEqual(cfg.modeE.pillars, [{ name: 'x' }]);
  assert.strictEqual(cfg.modeE.replyBack.enabled, true);
  assert.strictEqual(cfg.modeE.replyBack.maxPerHour, 3);
  assert.strictEqual(cfg.modeE.replyBack.pollMinutes, 10);
  assert.ok(added.includes('modeE.replyBack.pollMinutes'));
  assert.ok(!added.includes('modeE.ownUsername'));
  assert.deepStrictEqual(migrateConfig(cfg).added, []);
});

test('non-E configs are left alone', () => {
  assert.deepStrictEqual(migrateConfig({ mode: 'A', modeA: {} }).added, []);
});
