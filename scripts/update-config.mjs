/**
 * Upgrade data/config.json to the current structure without re-running the
 * wizard. Only adds missing keys (with safe defaults); your values are kept.
 * A backup is written next to it first.
 * Usage: npm run update-config
 */
import fs from 'fs';
import path from 'path';
import { migrateConfig } from '../src/lib/config-migrate.mjs';
import { parseJsonSafe } from '../src/lib/json-safe.mjs';

const CONFIG_PATH = path.resolve('data/config.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('data/config.json not found. Run: npm run setup');
  process.exit(1);
}

let current;
try {
  current = parseJsonSafe(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (e) {
  console.error(`data/config.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const { cfg, added } = migrateConfig(current);
if (added.length === 0) {
  console.log('data/config.json is already up to date.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.resolve(`data/config.backup-${stamp}.json`);
fs.copyFileSync(CONFIG_PATH, backup);
fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));

console.log(`Backup: ${backup}`);
console.log('Added to data/config.json:');
for (const k of added) console.log(`  + ${k}`);
console.log(`
Next steps (edit data/config.json):
  - modeE.ownUsername: your @handle (needed for reply-back + metrics)
  - modeE.pillars[ai_tech]: add listIds and set weight (e.g. 40) to post AI/tech
  - modeE.replyBack.enabled: true to auto-answer comments on your posts
  - modeE.autoTune.enabled: true after ~2 weeks of data (npm run report)
See guides/05-growth-strategy.md`);
