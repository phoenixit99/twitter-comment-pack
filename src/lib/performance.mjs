/**
 * Post performance — turns the metrics stored in post-history into
 * per-pillar / per-format / per-slot stats and weight multipliers.
 * Pure functions only (no network / fs) so they are easy to test.
 */

export function engagements(m = {}) {
  return (m.likes || 0) + (m.retweets || 0) + (m.replies || 0) + (m.quotes || 0) + (m.bookmarks || 0);
}

export function engagementRate(m = {}) {
  return m.views > 0 ? engagements(m) / m.views : 0;
}

/** @param {'views'|'engagements'|'engagementRate'} metric */
export function scoreOf(entry, metric = 'views') {
  const m = entry.metrics || {};
  if (metric === 'engagements') return engagements(m);
  if (metric === 'engagementRate') return engagementRate(m);
  return m.views || 0;
}

/**
 * Posts whose numbers have settled: have metrics, older than minAgeHours
 * (most reach happens in the first day), younger than maxAgeDays.
 */
export function matureEntries(history, { minAgeHours = 24, maxAgeDays = 21, now = Date.now() } = {}) {
  return history.filter((e) => {
    if (!e.metrics) return false;
    const age = now - new Date(e.postedAt).getTime();
    return age >= minAgeHours * 3600_000 && age <= maxAgeDays * 86400_000;
  });
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * @param {object[]} entries
 * @param {string} key  'pillar' | 'format' | 'type' (slot)
 * @returns {{ name: string, n: number, meanViews: number, medianViews: number, meanEngagements: number, er: number }[]} best first
 */
export function groupStats(entries, key) {
  const groups = new Map();
  for (const e of entries) {
    const name = e[key] || '(none)';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(e);
  }
  return [...groups.entries()]
    .map(([name, es]) => {
      const views = es.map((e) => e.metrics.views || 0);
      const engs = es.map((e) => engagements(e.metrics));
      const totalViews = views.reduce((a, b) => a + b, 0);
      return {
        name,
        n: es.length,
        meanViews: mean(views),
        medianViews: median(views),
        meanEngagements: mean(engs),
        er: totalViews > 0 ? engs.reduce((a, b) => a + b, 0) / totalViews : 0,
      };
    })
    .sort((a, b) => b.meanViews - a.meanViews);
}

/**
 * Weight multipliers per pillar and format: group mean score / overall mean
 * score, clamped. Groups with fewer than minSamples mature posts keep 1.
 *
 * @returns {{ pillar: Record<string, number>, format: Record<string, number>, sample: number }}
 */
export function computeTuning(history, opts = {}) {
  const { metric = 'views', minSamples = 5, minMult = 0.5, maxMult = 2 } = opts;
  const entries = matureEntries(history, opts);
  const overall = mean(entries.map((e) => scoreOf(e, metric)));
  const out = { pillar: {}, format: {}, sample: entries.length };
  if (overall <= 0) return out;

  for (const key of ['pillar', 'format']) {
    const groups = new Map();
    for (const e of entries) {
      if (!e[key]) continue;
      if (!groups.has(e[key])) groups.set(e[key], []);
      groups.get(e[key]).push(scoreOf(e, metric));
    }
    for (const [name, scores] of groups) {
      if (scores.length < minSamples) continue;
      const mult = mean(scores) / overall;
      out[key][name] = Math.round(Math.min(maxMult, Math.max(minMult, mult)) * 100) / 100;
    }
  }
  return out;
}

/** Tweet (from twitter-http parseTweetEntry) → metrics object stored in history. */
export function metricsFromTweet(t) {
  return {
    views: t.viewCount || 0,
    likes: t.favoriteCount || 0,
    retweets: t.retweetCount || 0,
    replies: t.replyCount || 0,
    quotes: t.quoteCount || 0,
    bookmarks: t.bookmarkCount || 0,
  };
}
