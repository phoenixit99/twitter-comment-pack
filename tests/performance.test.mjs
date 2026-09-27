import test from 'node:test';
import assert from 'node:assert';
import { engagements, engagementRate, matureEntries, groupStats, computeTuning, metricsFromTweet } from '../src/lib/performance.mjs';
import { pickPillar, pickFormat, applyMultipliers, getOwnUsername } from '../src/lib/content-plan.mjs';

const now = Date.parse('2026-09-27T12:00:00Z');
const post = (pillar, format, views, hoursAgo = 48, likes = 0) => ({
  pillar, format, type: 'slot', postedAt: new Date(now - hoursAgo * 3600_000).toISOString(),
  metrics: { views, likes, retweets: 0, replies: 0, quotes: 0, bookmarks: 0 },
});

test('engagement helpers', () => {
  const m = { views: 200, likes: 5, retweets: 1, replies: 2, quotes: 1, bookmarks: 1 };
  assert.strictEqual(engagements(m), 10);
  assert.strictEqual(engagementRate(m), 0.05);
  assert.strictEqual(engagementRate({}), 0);
});

test('metricsFromTweet maps parsed tweet fields', () => {
  assert.deepStrictEqual(
    metricsFromTweet({ viewCount: 900, favoriteCount: 7, retweetCount: 1, replyCount: 3, quoteCount: 0, bookmarkCount: 2 }),
    { views: 900, likes: 7, retweets: 1, replies: 3, quotes: 0, bookmarks: 2 }
  );
});

test('matureEntries keeps settled posts only', () => {
  const h = [post('a', 'x', 1, 2), post('a', 'x', 1, 48), post('a', 'x', 1, 24 * 40), { postedAt: new Date(now).toISOString() }];
  assert.strictEqual(matureEntries(h, { now }).length, 1);
});

test('groupStats sorts best first', () => {
  const g = groupStats([post('ai', 'x', 1000, 48, 20), post('crypto', 'x', 100), post('crypto', 'x', 300)], 'pillar');
  assert.deepStrictEqual(g.map((x) => [x.name, x.n, x.meanViews]), [['ai', 1, 1000], ['crypto', 2, 200]]);
  assert.strictEqual(g[0].er, 0.02);
});

test('computeTuning: multipliers vs overall mean, clamped, min samples', () => {
  const h = [
    ...Array(5).fill(0).map(() => post('ai_tech', 'mini_list', 3000)),
    ...Array(5).fill(0).map(() => post('crypto', 'hot_take', 1000)),
    post('crypto', 'question', 50),
  ];
  const t = computeTuning(h, { now });
  // overall mean ≈ 1823 → ai 1.65, crypto (6 posts, mean 842) 0.5 clamp? 842/1823=0.46 → 0.5
  assert.strictEqual(t.pillar.ai_tech, 1.65);
  assert.strictEqual(t.pillar.crypto, 0.5);
  assert.strictEqual(t.format.question, undefined, 'fewer than minSamples → untouched');
  assert.strictEqual(t.sample, 11);
  assert.deepStrictEqual(computeTuning([], { now }), { pillar: {}, format: {}, sample: 0 });
});

test('tuning shifts weighted picks but not pinned slots', () => {
  const cfg = { modeE: { schedule: { slots: [{ name: 'pin', pillar: 'crypto' }] }, pillars: [{ name: 'crypto', weight: 1 }, { name: 'ai', weight: 1 }] } };
  const tuning = { pillar: { crypto: 0.5, ai: 2 } };
  // total 2.5: crypto covers [0,0.5), ai [0.5,2.5)
  assert.strictEqual(pickPillar(cfg, 'free', () => 0.3, tuning).name, 'ai');
  assert.strictEqual(pickPillar(cfg, 'free', () => 0.3).name, 'crypto');
  assert.strictEqual(pickPillar(cfg, 'pin', () => 0.99, tuning).name, 'crypto');
  const f = pickFormat({ modeE: { formats: [{ name: 'a', weight: 1 }, { name: 'b', weight: 1 }] } }, {}, null, () => 0.3, { format: { a: 0.5, b: 2 } });
  assert.strictEqual(f.name, 'b');
  assert.deepStrictEqual(applyMultipliers([{ name: 'z', weight: 3 }], {}), [{ name: 'z', weight: 3 }]);
});

test('getOwnUsername fallbacks', () => {
  assert.strictEqual(getOwnUsername({ modeE: { ownUsername: '@Robert' } }), 'Robert');
  assert.strictEqual(getOwnUsername({ modeE: { replyBack: { ownUsername: 'rb' } } }), 'rb');
  assert.strictEqual(getOwnUsername({ modeB: { ownerUsername: 'b' } }), 'b');
  assert.strictEqual(getOwnUsername({}), '');
});
