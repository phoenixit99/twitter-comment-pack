import test from 'node:test';
import assert from 'node:assert';
import { classifyReply, cleanReplyText, selectReplyCandidates } from '../src/lib/reply-back-plan.mjs';

test('cleanReplyText strips leading mentions only', () => {
  assert.strictEqual(cleanReplyText('@RobertNguyen_99 @abc BTC lên 120k không @xyz?'), 'BTC lên 120k không @xyz?');
});

test('classifyReply', () => {
  assert.strictEqual(classifyReply('@me 🔥🔥'), 'like');
  assert.strictEqual(classifyReply('@me gm'), 'like');
  assert.strictEqual(classifyReply('@me check my profile for signals'), 'ignore');
  assert.strictEqual(classifyReply('@me join https://t.co/abc'), 'ignore');
  assert.strictEqual(classifyReply('@me Theo bạn ETH có vượt 5k trong Q4 không?'), 'reply');
});

const now = Date.parse('2026-09-27T12:00:00Z');
const at = (m) => new Date(now - m * 60_000).toISOString();
const base = {
  me: 'RobertNguyen_99',
  parents: new Map([['P1', 'P1'], ['P2', 'P2'], ['MYREPLY', 'P1']]),
  isHandled: (id) => id === 'handled',
  countFor: () => 0,
  countForRoot: () => 0,
  now,
};

test('selects replies to own posts/reply-backs only, oldest first', () => {
  const tweets = [
    { id: 'b', author: 'bob', fullText: '@me Bài này đúng ý mình quá, nhưng lãi suất thì sao?', inReplyToStatusId: 'P1', createdAt: at(5) },
    { id: 'a', author: 'alice', fullText: '@me Mình nghĩ SOL còn mạnh hơn ETH', inReplyToStatusId: 'P2', createdAt: at(30) },
    { id: 'c', author: 'carol', fullText: '@me reply to someone else post here', inReplyToStatusId: 'OTHER', createdAt: at(10) },
    { id: 'd', author: 'RobertNguyen_99', fullText: '@me my own reply in thread', inReplyToStatusId: 'P1', createdAt: at(10) },
    { id: 'handled', author: 'dan', fullText: '@me already handled this one', inReplyToStatusId: 'P1', createdAt: at(10) },
    { id: 'old', author: 'eve', fullText: '@me very old reply here', inReplyToStatusId: 'P1', createdAt: at(60 * 30) },
    { id: 'e', author: 'bob', fullText: '@me Ok vậy còn Fed thì sao bạn?', inReplyToStatusId: 'MYREPLY', createdAt: at(1) },
  ];
  const out = selectReplyCandidates(tweets, base);
  assert.deepStrictEqual(out.map((c) => [c.tweet.id, c.rootId, c.action]), [
    ['a', 'P2', 'reply'],
    ['b', 'P1', 'reply'],
    ['e', 'P1', 'reply'],
  ]);
});

test('per-author and per-post caps downgrade to like', () => {
  const tweets = [1, 2, 3].map((i) => ({ id: `t${i}`, author: 'bob', fullText: '@me câu hỏi số ' + i + ' về thị trường?', inReplyToStatusId: 'P1', createdAt: at(10 - i) }));
  const out = selectReplyCandidates(tweets, { ...base, maxPerAuthorPerPost: 2 });
  assert.deepStrictEqual(out.map((c) => c.action), ['reply', 'reply', 'like']);

  const out2 = selectReplyCandidates(tweets, { ...base, countForRoot: () => 10, maxPerPost: 10 });
  assert.deepStrictEqual(out2.map((c) => c.action), ['like', 'like', 'like']);
});
