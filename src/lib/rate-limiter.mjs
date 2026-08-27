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
  
  if (elapsed === Infinity) {
    log(`[rate] post history is empty (fresh start or database reset). Posting allowed immediately.`);
    return true;
  }
  
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

/**
 * Check if current time (GMT+7) is within a defined posting slot.
 * @param {Object} cfg 
 * @returns {string|null} Slot name (e.g. "morning_breakdown") or null if outside slots
 */
export function getPostScheduleSlot(cfg) {
  if (!cfg.modeE?.schedule?.slots) return null;
  
  // Convert current UTC time to GMT+7
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt7Ms = utcMs + (7 * 60 * 60000); // +7 hours
  const gmt7Date = new Date(gmt7Ms);
  
  const currentHour = gmt7Date.getHours();
  const currentMinute = gmt7Date.getMinutes();
  const currentDecimalHour = currentHour + (currentMinute / 60);

  for (const slot of cfg.modeE.schedule.slots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    
    const startDecimal = startH + (startM / 60);
    const endDecimal = endH + (endM / 60);
    
    if (currentDecimalHour >= startDecimal && currentDecimalHour <= endDecimal) {
      return slot.name;
    }
  }
  return null;
}

/**
 * Calculates roughly how many minutes until the next scheduled slot.
 * Used for sleeping the loop when outside all slots.
 */
export function msUntilNextSlot(cfg) {
  if (!cfg.modeE?.schedule?.slots || cfg.modeE.schedule.slots.length === 0) {
    return 15 * 60 * 1000; // default 15m
  }
  
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt7Ms = utcMs + (7 * 60 * 60000);
  const gmt7Date = new Date(gmt7Ms);
  
  const currentHour = gmt7Date.getHours();
  const currentMinute = gmt7Date.getMinutes();
  const currentDecimalHour = currentHour + (currentMinute / 60);
  
  let minWaitHours = 24;
  
  for (const slot of cfg.modeE.schedule.slots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const startDecimal = startH + (startM / 60);
    
    let diff = startDecimal - currentDecimalHour;
    if (diff <= 0) diff += 24; // next day
    
    if (diff < minWaitHours) {
      minWaitHours = diff;
    }
  }
  
  // Convert hours to ms, cap at max sleep of 15 mins so we check periodically anyway
  const msWait = Math.floor(minWaitHours * 60 * 60 * 1000);
  return Math.min(msWait, 15 * 60 * 1000);
}

