import { commentsInLastHour, postsInLast24Hours, timeSinceLastPost } from './store.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForSlot(cfg, log) {
  while (true) {
    const cap = cfg.commentsPerHour;
    const count = commentsInLastHour();
    if (count < cap) return;
    const waitMs = 5 * 60_000 + Math.floor(Math.random() * 60_000);
    log(`[rate] cap ${count}/${cap} reached — sleeping ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

export async function waitForPostSlot(cfg, log) {
  while (true) {
    const postsPerDay = cfg.postsPerDay || 5;
    const count24h = postsInLast24Hours();
    if (count24h >= postsPerDay) {
      const waitMs = 60 * 60_000 + Math.floor(Math.random() * 5 * 60_000); // Wait ~1 hour
      log(`[rate] post cap ${count24h}/${postsPerDay} per day reached — sleeping ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }

    const minGapMs = (24 * 60 * 60 * 1000) / postsPerDay;
    const elapsed = timeSinceLastPost();
    if (elapsed < minGapMs) {
      const remainder = minGapMs - elapsed;
      const waitMs = remainder + Math.floor(Math.random() * 60_000); // Remainder + jitter up to 1 min
      log(`[rate] post gap enforcement. Elapsed ${Math.round(elapsed / 1000)}s / Required ${Math.round(minGapMs / 1000)}s — sleeping ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }

    // Slot is ready
    return;
  }
}

export async function postSleep(cfg, log) {
  const { delayMinMs = 60_000, delayMaxMs = 240_000 } = cfg;
  const ms = delayMinMs + Math.floor(Math.random() * Math.max(1, delayMaxMs - delayMinMs));
  log(`[rate] post-sleep ${Math.round(ms / 1000)}s`);
  await sleep(ms);
}
