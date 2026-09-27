import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db = null;

export function initStore(dbPath = 'data/store.db') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS commented (
      tweet_id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      author TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_commented_ts ON commented(ts);

    CREATE TABLE IF NOT EXISTS posted (
      tweet_id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      author TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posted_ts ON posted(ts);

    CREATE TABLE IF NOT EXISTS warmup_state (
      target TEXT NOT NULL,
      tweet_id TEXT NOT NULL,
      action TEXT NOT NULL,
      last_action_ts INTEGER NOT NULL,
      PRIMARY KEY(target, tweet_id, action)
    );

    CREATE TABLE IF NOT EXISTS replied_back (
      reply_id TEXT PRIMARY KEY,
      root_id TEXT NOT NULL,
      author TEXT,
      my_tweet_id TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_replied_back_ts ON replied_back(ts);

    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT
    );
  `);
  return db;
}

export function alreadyCommented(tweetId) {
  if (!db) return false;
  const row = db.prepare('SELECT 1 FROM commented WHERE tweet_id = ?').get(tweetId);
  return !!row;
}

export function markCommented(tweetId, author = '') {
  db.prepare('INSERT OR REPLACE INTO commented(tweet_id, ts, author) VALUES(?, ?, ?)')
    .run(tweetId, Date.now(), author);
}

export function commentsInLastHour() {
  if (!db) return 0;
  const since = Date.now() - 60 * 60 * 1000;
  const row = db.prepare('SELECT COUNT(*) AS c FROM commented WHERE ts >= ?').get(since);
  return row.c;
}

export function warmupSeen(target, tweetId, action) {
  if (!db) return false;
  const row = db.prepare(
    'SELECT 1 FROM warmup_state WHERE target = ? AND tweet_id = ? AND action = ?'
  ).get(target, tweetId, action);
  return !!row;
}

export function warmupMark(target, tweetId, action) {
  db.prepare(
    'INSERT OR REPLACE INTO warmup_state(target, tweet_id, action, last_action_ts) VALUES(?, ?, ?, ?)'
  ).run(target, tweetId, action, Date.now());
}

export function getMeta(k) {
  if (!db) return null;
  const row = db.prepare('SELECT v FROM meta WHERE k = ?').get(k);
  return row ? row.v : null;
}

export function setMeta(k, v) {
  db.prepare('INSERT OR REPLACE INTO meta(k, v) VALUES(?, ?)').run(k, String(v));
}

export function alreadyPosted(tweetId) {
  if (!db) return false;
  const row = db.prepare('SELECT 1 FROM posted WHERE tweet_id = ?').get(tweetId);
  return !!row;
}

export function markPosted(tweetId, author = '') {
  db.prepare('INSERT OR REPLACE INTO posted(tweet_id, ts, author) VALUES(?, ?, ?)')
    .run(tweetId, Date.now(), author);
}

export function postsInLastHour() {
  if (!db) return 0;
  const since = Date.now() - 60 * 60 * 1000;
  const row = db.prepare('SELECT COUNT(*) AS c FROM posted WHERE ts >= ?').get(since);
  return row.c;
}

export function timeSinceLastPost() {
  if (!db) return Infinity;
  const row = db.prepare('SELECT ts FROM posted ORDER BY ts DESC LIMIT 1').get();
  if (!row) return Infinity;
  return Date.now() - row.ts;
}

// --- Reply-back (answering replies on our own posts) ---

export function alreadyRepliedBack(replyId) {
  if (!db) return false;
  const row = db.prepare('SELECT 1 FROM replied_back WHERE reply_id = ?').get(replyId);
  return !!row;
}

/** myTweetId is null when we only liked the reply (still marks it handled). */
export function markRepliedBack({ replyId, rootId, author = '', myTweetId = null }) {
  db.prepare('INSERT OR REPLACE INTO replied_back(reply_id, root_id, author, my_tweet_id, ts) VALUES(?, ?, ?, ?, ?)')
    .run(replyId, rootId, author, myTweetId, Date.now());
}

export function repliedBackInLastHour() {
  if (!db) return 0;
  const since = Date.now() - 60 * 60 * 1000;
  const row = db.prepare('SELECT COUNT(*) AS c FROM replied_back WHERE ts >= ? AND my_tweet_id IS NOT NULL').get(since);
  return row.c;
}

/** Our own reply-back tweets since `sinceMs`, as [{ myTweetId, rootId }]. */
export function getMyReplyBacks(sinceMs) {
  if (!db) return [];
  return db.prepare('SELECT my_tweet_id AS myTweetId, root_id AS rootId FROM replied_back WHERE ts >= ? AND my_tweet_id IS NOT NULL')
    .all(sinceMs);
}

/** How many times we answered `author` under root post `rootId`. */
export function repliedBackCount(rootId, author) {
  if (!db) return 0;
  const row = db.prepare('SELECT COUNT(*) AS c FROM replied_back WHERE root_id = ? AND lower(author) = lower(?) AND my_tweet_id IS NOT NULL')
    .get(rootId, author);
  return row.c;
}

export function repliedBackCountForRoot(rootId) {
  if (!db) return 0;
  const row = db.prepare('SELECT COUNT(*) AS c FROM replied_back WHERE root_id = ? AND my_tweet_id IS NOT NULL').get(rootId);
  return row.c;
}
