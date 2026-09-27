/**
 * Performance report for Mode E posts.
 * Usage: npm run report            (all posts with metrics)
 *        npm run report -- 7       (last 7 days only)
 * Metrics come from the Mode E metrics sync (needs modeE.ownUsername).
 */
import { getAllPosts } from '../src/lib/post-history.mjs';
import { groupStats, engagements, computeTuning } from '../src/lib/performance.mjs';

const days = Number(process.argv[2]) || 3650;
const now = Date.now();
const all = getAllPosts();
const entries = all.filter(
  (e) => e.metrics && now - new Date(e.postedAt).getTime() <= days * 86400_000
);

if (entries.length === 0) {
  console.log(`No posts with metrics yet (${all.length} posts in history).`);
  console.log('Set modeE.ownUsername in data/config.json and let Mode E run — metrics sync every 2h.');
  process.exit(0);
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => (x * 100).toFixed(1) + '%';

function table(title, key) {
  console.log(`\n=== By ${title} ===`);
  console.log('name'.padEnd(22) + 'posts'.padStart(6) + 'avg views'.padStart(11) + 'median'.padStart(9) + 'avg eng'.padStart(9) + 'ER'.padStart(7));
  for (const g of groupStats(entries, key)) {
    console.log(
      g.name.slice(0, 21).padEnd(22) + String(g.n).padStart(6) + fmt(g.meanViews).padStart(11) +
      fmt(g.medianViews).padStart(9) + g.meanEngagements.toFixed(1).padStart(9) + pct(g.er).padStart(7)
    );
  }
}

console.log(`Posts with metrics: ${entries.length} (last ${days === 3650 ? 'all' : days + ' days'})`);
table('pillar', 'pillar');
table('format', 'format');
table('slot', 'type');

console.log('\n=== Top 5 posts (copy what works) ===');
[...entries]
  .sort((a, b) => (b.metrics.views || 0) - (a.metrics.views || 0))
  .slice(0, 5)
  .forEach((e) => {
    console.log(`${fmt(e.metrics.views).padStart(7)} views · ${engagements(e.metrics)} eng · ${e.pillar || '-'} / ${e.format || '-'} / ${e.type}`);
    console.log(`        ${e.content.replace(/\n/g, ' ').slice(0, 110)}`);
  });

const t = computeTuning(all);
console.log(`\nAuto-tune multipliers (views, ≥5 mature posts per group): pillar=${JSON.stringify(t.pillar)} format=${JSON.stringify(t.format)}`);
