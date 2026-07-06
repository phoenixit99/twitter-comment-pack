import { commentsInLastHour, postsInLastHour, timeSinceLastPost } from './store.mjs';

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
  const postsPerDay = cfg.postsPerDay || 5;
  const minGapMs = (24 * 60 * 60 * 1000) / postsPerDay;
  const elapsed = timeSinceLastPost();
  
  if (elapsed < minGapMs) {
    const remainder = minGapMs - elapsed;
    log(`[rate] post gap enforcement. Required gap ${Math.round(minGapMs / 60000)}m. Wait ${Math.round(remainder / 60000)}m more.`);
    return false;
  }
  return true;
}

export async function postSleep(cfg, log) {
  const { delayMinMs = 60_000, delayMaxMs = 240_000 } = cfg;
  const ms = delayMinMs + Math.floor(Math.random() * Math.max(1, delayMaxMs - delayMinMs));
  log(`[rate] post-sleep ${Math.round(ms / 1000)}s`);
  await sleep(ms);
}
