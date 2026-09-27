/**
 * Mode E metrics sync — pull views / likes / replies / reposts / quotes /
 * bookmarks for our recent posts into data/post-history.json, so we can see
 * (npm run report) and auto-tune which pillars and formats perform.
 *
 * Config (modeE.autoTune):
 *   enabled, metric ('views'|'engagements'|'engagementRate'), minSamples,
 *   minAgeHours, maxAgeDays, syncHours
 */
import { searchUserTweets } from '../lib/twitter-http.mjs';
import { updateMetrics, getAllPosts } from '../lib/post-history.mjs';
import { metricsFromTweet, computeTuning } from '../lib/performance.mjs';
import { getOwnUsername } from '../lib/content-plan.mjs';

export function getAutoTuneConfig(cfg) {
  const t = cfg.modeE?.autoTune || {};
  return {
    enabled: t.enabled === true,
    metric: t.metric || 'views',
    minSamples: t.minSamples ?? 5,
    minAgeHours: t.minAgeHours ?? 24,
    maxAgeDays: t.maxAgeDays ?? 21,
    minMult: t.minMult ?? 0.5,
    maxMult: t.maxMult ?? 2,
    syncHours: t.syncHours ?? 2,
  };
}

/** Weight multipliers for pickPillar / pickFormat, or null when auto-tune is off. */
export function getTuning(cfg) {
  const t = getAutoTuneConfig(cfg);
  if (!t.enabled) return null;
  return computeTuning(getAllPosts(), t);
}

/**
 * One sync. Returns the number of history entries updated.
 */
export async function runMetricsSync(cfg, log) {
  const me = getOwnUsername(cfg);
  if (!me) {
    log('[metrics] modeE.ownUsername is not set. Skipping metrics sync.');
    return 0;
  }
  // Our own timeline, newest first; 60 covers ~a week at 6–10 posts/day
  const tweets = await searchUserTweets(me, cfg.cookiesFile, 60);
  const byId = new Map(tweets.map((t) => [t.id, metricsFromTweet(t)]));
  const n = updateMetrics(byId);
  log(`[metrics] fetched ${tweets.length} tweets, updated ${n} posts in history`);

  const tuning = getTuning(cfg);
  if (tuning) {
    log(`[metrics] auto-tune from ${tuning.sample} mature posts: pillar=${JSON.stringify(tuning.pillar)} format=${JSON.stringify(tuning.format)}`);
  }
  return n;
}
