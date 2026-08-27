import test from 'node:test';
import assert from 'node:assert';
import { initStore, markCommented, markPosted } from '../src/lib/store.mjs';
import { waitForSlot, waitForPostSlot } from '../src/lib/rate-limiter.mjs';

test('Mode E Rate Limiting Tests', async (t) => {
  // Use in-memory SQLite database for testing
  initStore(':memory:');

  // We'll mock Date.now() to control time
  const originalDateNow = Date.now;
  let currentTime = 1000000000000;
  Date.now = () => currentTime;

  const mockLog = (msg) => {}; // Silence logs for tests

  await t.test('Reply per hour limit (waitForSlot)', async () => {
    const cfg = { commentsPerHour: 15 };
    
    // Fill up the quota for the last hour
    for (let i = 0; i < 15; i++) {
      markCommented(`tweet_${i}`, 'test_author');
    }

    // Since we hit the cap of 15, waitForSlot should ideally loop. 
    // To test this without actually sleeping and hanging the test, 
    // we can either mock sleep() or just test the store functions directly.
    // However, the `rate-limiter.mjs` file uses an un-exported `sleep` function.
    // Let's test the underlying store logic that rate-limiter relies on.
    
    // Instead of waiting, we can check the count.
    const { commentsInLastHour } = await import('../src/lib/store.mjs');
    let count = commentsInLastHour();
    assert.strictEqual(count, 15, 'Should have 15 comments in the last hour');

    // Move time forward by 30 minutes
    currentTime += 30 * 60 * 1000;
    count = commentsInLastHour();
    assert.strictEqual(count, 15, 'Should still have 15 comments in the last hour');

    // Move time forward by another 31 minutes (total 61 minutes)
    currentTime += 31 * 60 * 1000;
    count = commentsInLastHour();
    assert.strictEqual(count, 0, 'Comments should have expired from the 1 hour window');
  });

  await t.test('Post per day limit (waitForPostSlot)', async () => {
    const cfg = { postsPerDay: 5 };
    
    // Fresh start, should allow posting
    let isReady = await waitForPostSlot(cfg, mockLog);
    assert.strictEqual(isReady, true, 'Should allow posting on fresh start');

    // Mark a post as done
    markPosted('post_1', 'test_author');

    // Immediately after, it should NOT allow posting, as we need a gap
    // Min gap is (24 * 60 * 60 * 1000) / 5 = 4.8 hours
    isReady = await waitForPostSlot(cfg, mockLog);
    assert.strictEqual(isReady, false, 'Should NOT allow posting immediately after a post');

    // Advance time by 4 hours
    currentTime += 4 * 60 * 60 * 1000;
    isReady = await waitForPostSlot(cfg, mockLog);
    assert.strictEqual(isReady, false, 'Should NOT allow posting after only 4 hours (gap is 4.8 hours)');

    // Advance time by another 1 hour (total 5 hours)
    currentTime += 1 * 60 * 60 * 1000;
    isReady = await waitForPostSlot(cfg, mockLog);
    assert.strictEqual(isReady, true, 'Should allow posting after 5 hours (exceeds 4.8 hour gap)');
  });

  // Restore Date.now
  Date.now = originalDateNow;
});
