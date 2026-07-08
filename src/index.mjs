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
import { runWarmup } from './warmup.mjs';

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
  log('Twitter Comment Pack starting...');
  const cfg = loadConfig();
  initStore('data/store.db');
  log(`Mode: ${cfg.mode} | AI: ${cfg.ai.provider} | Rate: ${cfg.commentsPerHour}/hr | Posts: ${cfg.postsPerDay}/day`);

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
    log('[mode-E] Running A and D loops concurrently in parallel');
    await Promise.all([
      runCommentLoop(cfg),
      runPostLoop(cfg)
    ]);
  }
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try {
    const cfg = loadConfig();
    await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] FATAL: ${e.message}`);
  } catch {}
  process.exit(1);
});
