/**
 * Twitter Comment Pack — main entrypoint.
 */
import fs from 'fs';
import path from 'path';
import { loadConfig } from './config.mjs';
import { initStore } from './lib/store.mjs';
import { sendAlert } from './lib/telegram.mjs';
import { runListMode } from './modes/list-comment.mjs';
import { runAmplifyMode } from './modes/amplify.mjs';
import { runHybridMode } from './modes/hybrid.mjs';
import { runHybridADMode } from './modes/hybrid-ad.mjs';
import { runAutoPostMode } from './modes/auto-post.mjs';
import { runAutonomousPostMode } from './modes/autonomous-post.mjs';
import { runReplyBackMode, getReplyBackConfig } from './modes/reply-back.mjs';
import { runMetricsSync, getAutoTuneConfig } from './modes/metrics-sync.mjs';
import { getOwnUsername } from './lib/content-plan.mjs';
import { migrateConfig } from './lib/config-migrate.mjs';
import { runWarmup } from './warmup.mjs';
import { acquireLock } from './lib/instance-lock.mjs';

const DEBUG = process.argv.includes('--debug');
const RUN_LOG = 'data/run.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const dir = path.dirname(RUN_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(RUN_LOG, line + '\n');
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleFatalError(e, cfg) {
  if (/SESSION_EXPIRED|401|403/.test(e.message)) {
    await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId,
      `[twitter-comment-pack] STOPPED: ${e.message}`);
    process.exit(1);
  }
}

async function runCommentLoop(cfg) {
  const commentsPerHour = cfg.commentsPerHour || 15;
  const targetIntervalMs = (60 * 60 * 1000) / commentsPerHour;
  log(`Starting Comment Loop. Target rate: ${commentsPerHour}/hr (~${Math.round(targetIntervalMs / 60000)}m interval)`);

  while (true) {
    try {
      await runListMode(cfg, log);
    } catch (e) {
      log(`Comment loop error: ${e.message}`);
      await handleFatalError(e, cfg);
    }
    const cycleSleep = targetIntervalMs * (0.8 + Math.random() * 0.4);
    const clampedSleep = Math.max(30_000, Math.min(15 * 60_000, cycleSleep));
    log(`Comment cycle done. Sleeping ${Math.round(clampedSleep / 1000)}s.`);
    await sleep(clampedSleep);
  }
}

async function runPostLoop(cfg) {
  // Check lists for posts every 15 minutes
  const checkIntervalMs = 15 * 60 * 1000;
  log(`Starting Post Loop. Active checking interval: 15m`);

  while (true) {
    try {
      await runAutoPostMode(cfg, log);
    } catch (e) {
      log(`Post loop error: ${e.message}`);
      await handleFatalError(e, cfg);
    }
    const cycleSleep = checkIntervalMs * (0.9 + Math.random() * 0.2);
    log(`Post cycle done. Sleeping ${Math.round(cycleSleep / 60000)} min.`);
    await sleep(cycleSleep);
  }
}

async function runAmplifyLoop(cfg) {
  while (true) {
    try {
      await runAmplifyMode(cfg, log);
    } catch (e) {
      log(`Amplify loop error: ${e.message}`);
      await handleFatalError(e, cfg);
    }
    const cycleSleep = 5 * 60 * 1000 + Math.floor(Math.random() * 5 * 60 * 1000);
    log(`Amplify cycle done. Sleeping ${Math.round(cycleSleep / 60000)} min.`);
    await sleep(cycleSleep);
  }
}

async function runHybridLoop(cfg) {
  while (true) {
    try {
      await runHybridMode(cfg, log);
    } catch (e) {
      log(`Hybrid loop error: ${e.message}`);
      await handleFatalError(e, cfg);
    }
    const cycleSleep = 5 * 60 * 1000 + Math.floor(Math.random() * 5 * 60 * 1000);
    log(`Hybrid cycle done. Sleeping ${Math.round(cycleSleep / 60000)} min.`);
    await sleep(cycleSleep);
  }
}

async function main() {
  const lock = acquireLock();
  if (!lock.ok) {
    log(`Another bot process is already running (pid ${lock.pid}). Exiting so posts are not duplicated.`);
    process.exit(0);
  }
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
  log('Twitter Comment Pack starting...');
  const cfg = loadConfig();
  initStore('data/store.db');
  log(`Mode: ${cfg.mode} | AI: ${cfg.ai.provider} | Rate: ${cfg.commentsPerHour}/hr | Posts: ${cfg.postsPerDay}/day`);

  const missing = migrateConfig(cfg).added;
  if (missing.length > 0) {
    log(`[config] data/config.json is missing new settings (${missing.join(', ')}). Run: npm run update-config`);
  }

  await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId,
    `[twitter-comment-pack] started in mode ${cfg.mode}`);

  // Schedule background session check every 2h, plus once on startup
  const runHealth = async () => {
    try { await runWarmup(cfg, DEBUG); } catch {}
  };
  runHealth();
  setInterval(runHealth, 2 * 60 * 60 * 1000);

  // Main mode loop selector
  if (cfg.mode === 'A') {
    await runCommentLoop(cfg);
  } else if (cfg.mode === 'B') {
    await runAmplifyLoop(cfg);
  } else if (cfg.mode === 'C') {
    await runHybridLoop(cfg);
  } else if (cfg.mode === 'D') {
    await runPostLoop(cfg);
  } else if (cfg.mode === 'E') {
    await runAutonomousLoop(cfg);
  }
}

async function runAutonomousLoop(cfg) {
  log(`Starting Mode E (Autonomous Post + List Comment + optional Reply-back / Metrics sync)`);

  // Shared state to pause comments for 20 mins after a post
  let commentPauseUntil = 0;

  // LOOP 1: Autonomous Posting
  const postLoop = async () => {
    while (true) {
      try {
        const result = await runAutonomousPostMode(cfg, log);
        
        if (result === 'POSTED') {
          // Pause comments for 20 minutes (1200000 ms)
          commentPauseUntil = Date.now() + 20 * 60 * 1000;
          log(`[mode-E] Post successful. Pausing comments until ${new Date(commentPauseUntil).toLocaleTimeString()}`);
          await sleep(15 * 60 * 1000); // Wait at least 15m before trying next post logic
        } else if (typeof result === 'number') {
          // result is ms to sleep
          await sleep(result);
        } else {
          // Fallback sleep
          await sleep(15 * 60 * 1000);
        }
      } catch (e) {
        log(`[mode-E] Post loop error: ${e.message}`);
        await handleFatalError(e, cfg);
        await sleep(5 * 60 * 1000); // Sleep 5m on error
      }
    }
  };

  // LOOP 2: Commenting (same as Mode A)
  const commentLoop = async () => {
    const commentsPerHour = cfg.commentsPerHour || 15;
    const targetIntervalMs = (60 * 60 * 1000) / commentsPerHour;
    
    while (true) {
      if (Date.now() < commentPauseUntil) {
        const waitMs = commentPauseUntil - Date.now();
        log(`[mode-E] Comments paused due to recent post. Waiting ${Math.round(waitMs / 60000)}m...`);
        await sleep(waitMs);
        continue;
      }

      try {
        await runListMode(cfg, log);
      } catch (e) {
        log(`[mode-E] Comment loop error: ${e.message}`);
        await handleFatalError(e, cfg);
      }
      
      const cycleSleep = targetIntervalMs * (0.8 + Math.random() * 0.4);
      const clampedSleep = Math.max(30_000, Math.min(15 * 60_000, cycleSleep));
      log(`[mode-E] Comment cycle done. Sleeping ${Math.round(clampedSleep / 1000)}s.`);
      await sleep(clampedSleep);
    }
  };

  // LOOP 3: Reply-back — answer people who reply to our own posts.
  // Not paused after a post: the first hour is exactly when it matters.
  const replyBackLoop = async () => {
    const rb = getReplyBackConfig(cfg);
    log(`[reply-back] enabled as @${rb.ownUsername || '?'} — polling every ${rb.pollMinutes}m, max ${rb.maxPerHour}/hr`);
    while (true) {
      try {
        await runReplyBackMode(cfg, log);
      } catch (e) {
        log(`[reply-back] loop error: ${e.message}`);
        await handleFatalError(e, cfg);
      }
      await sleep(rb.pollMinutes * 60 * 1000 * (0.8 + Math.random() * 0.4));
    }
  };

  // LOOP 4: Metrics sync — views/engagement of own posts into post-history
  // (feeds `npm run report` and modeE.autoTune)
  const metricsLoop = async () => {
    const { syncHours } = getAutoTuneConfig(cfg);
    log(`[metrics] syncing own post metrics every ${syncHours}h`);
    while (true) {
      try {
        await runMetricsSync(cfg, log);
      } catch (e) {
        log(`[metrics] sync error: ${e.message}`);
      }
      await sleep(syncHours * 3600 * 1000 * (0.9 + Math.random() * 0.2));
    }
  };

  // Run loops concurrently
  const loops = [postLoop()];
  if (cfg.commentsPerHour > 0) loops.push(commentLoop());
  else log('[mode-E] commentsPerHour is 0 — list comments are off');
  if (getReplyBackConfig(cfg).enabled) loops.push(replyBackLoop());
  if (getOwnUsername(cfg)) loops.push(metricsLoop());
  await Promise.all(loops);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try {
    const cfg = loadConfig();
    await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] FATAL: ${e.message}`);
  } catch {}
  process.exit(1);
});
