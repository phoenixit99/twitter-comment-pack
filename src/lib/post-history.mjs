/**
 * Post history — tracks recent original posts to avoid duplicate openings
 * and provide analytics data.
 */
import fs from 'fs';
import path from 'path';

const HISTORY_PATH = path.resolve('data/post-history.json');
const MAX_ENTRIES = 50;

function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * Get the opening sentences of the N most recent posts.
 * @param {number} n
 * @returns {string[]}
 */
export function getRecentOpenings(n = 5) {
  const history = readHistory();
  return history
    .slice(-n)
    .map((entry) => {
      const firstLine = (entry.content || '').split('\n')[0].trim();
      return firstLine.split(/[.?!]/)[0].trim();
    })
    .filter(Boolean);
}

/**
 * Add a posted entry to history.
 * @param {{ content: string, type: string, postedAt: string, tweetId: string }} entry
 */
export function addPost(entry) {
  const history = readHistory();
  history.push(entry);
  // Keep only last MAX_ENTRIES
  if (history.length > MAX_ENTRIES) {
    history.splice(0, history.length - MAX_ENTRIES);
  }
  writeHistory(history);
}

/**
 * Check if a post was already made for a given slot on a given date.
 * @param {string} slotName — e.g. "morning_breakdown"
 * @param {string} date — e.g. "2026-08-27"
 * @returns {boolean}
 */
export function hasPostedInSlot(slotName, date) {
  const history = readHistory();
  return history.some(
    (entry) =>
      entry.type === slotName &&
      entry.postedAt &&
      entry.postedAt.startsWith(date)
  );
}

/**
 * Get today's posts count.
 * @param {string} date — e.g. "2026-08-27"
 * @returns {number}
 */
export function todayPostCount(date) {
  const history = readHistory();
  return history.filter(
    (entry) => entry.postedAt && entry.postedAt.startsWith(date)
  ).length;
}

/**
 * Format of the most recent post (Mode E content plan), or null.
 * @returns {string|null}
 */
export function getLastFormat() {
  const history = readHistory();
  return history.length ? history[history.length - 1].format || null : null;
}

/**
 * IDs of source tweets already used as research context, so the same hot
 * tweet is not rewritten into several posts.
 * @returns {Set<string>}
 */
export function getUsedSourceIds() {
  return new Set(readHistory().map((e) => e.sourceTweetId).filter(Boolean));
}

/**
 * Own original posts published in the last `hours` hours.
 * @returns {{ tweetId: string, content: string, postedAt: string }[]}
 */
export function getRecentPosts(hours = 24, now = Date.now()) {
  const cutoff = now - hours * 3600_000;
  return readHistory().filter(
    (e) => e.tweetId && e.tweetId !== 'ok' && new Date(e.postedAt).getTime() >= cutoff
  );
}
