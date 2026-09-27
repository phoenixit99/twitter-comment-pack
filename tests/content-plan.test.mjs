import test from 'node:test';
import assert from 'node:assert';
import { getPillars, pickPillar, pickFormat, pickTopic, rankSourceTweets, weightedPick, DEFAULT_FORMATS, DEFAULT_PROMPT_FILE } from '../src/lib/content-plan.mjs';
import { checkDraft } from '../src/lib/quality-gate.mjs';

const pillarCfg = {
  modeE: {
    listIds: ['legacy'],
    schedule: { slots: [{ name: 'morning', start: '07:00', end: '08:00', pillar: 'ai_tech' }, { name: 'noon', start: '11:00', end: '12:00' }] },
    pillars: [
      { name: 'crypto', weight: 1, listIds: ['c1'], topics: ['BTC'] },
      { name: 'ai_tech', weight: 1, listIds: ['a1'], promptFile: 'prompts/post_ai_tech.txt' },
    ],
  },
};

test('legacy config becomes a single default pillar', () => {
  const [p, ...rest] = getPillars({ modeE: { listIds: ['x'], topics: ['t'] } });
  assert.strictEqual(rest.length, 0);
  assert.deepStrictEqual(p.listIds, ['x']);
  assert.deepStrictEqual(p.topics, ['t']);
  assert.strictEqual(p.promptFile, DEFAULT_PROMPT_FILE);
});

test('pillar without listIds falls back to modeE.listIds', () => {
  const p = getPillars({ modeE: { listIds: ['x'], pillars: [{ name: 'p' }] } })[0];
  assert.deepStrictEqual(p.listIds, ['x']);
});

test('slot can pin a pillar; otherwise weighted pick', () => {
  assert.strictEqual(pickPillar(pillarCfg, 'morning', () => 0).name, 'ai_tech');
  assert.strictEqual(pickPillar(pillarCfg, 'noon', () => 0).name, 'crypto');
  assert.strictEqual(pickPillar(pillarCfg, 'noon', () => 0.99).name, 'ai_tech');
});

test('weightedPick ignores zero weight', () => {
  assert.strictEqual(weightedPick([{ n: 'a', weight: 0 }, { n: 'b', weight: 1 }], () => 0).n, 'b');
  assert.strictEqual(weightedPick([{ weight: 0 }]), null);
});

test('pickFormat never repeats the previous format', () => {
  for (let i = 0; i < 50; i++) {
    const f = pickFormat({}, {}, 'hot_take', Math.random);
    assert.notStrictEqual(f.name, 'hot_take');
  }
  assert.ok(DEFAULT_FORMATS.find((f) => f.name === pickFormat({}, {}, null, () => 0).name));
});

test('pickTopic handles empty topics', () => {
  assert.strictEqual(pickTopic({ topics: [] }), '');
  assert.strictEqual(pickTopic({ topics: ['a', 'b'] }, () => 0.9), 'b');
});

test('rankSourceTweets drops used/duplicate, prefers fresh, sorts by engagement', () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  const pool = [
    { id: '1', createdAt: '2026-09-27T10:00:00Z', favoriteCount: 5 },
    { id: '2', createdAt: '2026-09-27T11:00:00Z', favoriteCount: 50 },
    { id: '2', createdAt: '2026-09-27T11:00:00Z', favoriteCount: 50 },
    { id: '3', createdAt: '2026-09-20T11:00:00Z', favoriteCount: 9999 },
    { id: '4', createdAt: '2026-09-27T11:30:00Z', favoriteCount: 1, retweetCount: 20 },
  ];
  const ranked = rankSourceTweets(pool, new Set(['1']), now);
  assert.deepStrictEqual(ranked.map((t) => t.id), ['4', '2']);
  // all stale → still returns something
  assert.deepStrictEqual(rankSourceTweets([pool[3]], new Set(), now).map((t) => t.id), ['3']);
});

test('checkDraft only requires a question when asked', () => {
  const text = 'BTC vừa giữ được mốc 100k sau 3 phiên test liên tiếp, dòng tiền ETF vẫn vào đều.';
  assert.strictEqual(checkDraft(text).pass, false);
  assert.strictEqual(checkDraft(text, [], { requireQuestion: false }).pass, true);
});
