/**
 * Mode E reply-back — answer people who reply to our own posts.
 *
 * X weights "author replied to a reply" heavily, and answering within the
 * first hour keeps the conversation (and the post) alive in the feed.
 *
 * Config (modeE.replyBack):
 *   enabled, ownUsername, pollMinutes, lookbackHours, maxPerHour,
 *   maxPerPost, maxPerAuthorPerPost, likeReplies, delayMinMs, delayMaxMs, promptFile
 */
import { searchTimeline, postTweet, favoriteTweet } from '../lib/twitter-http.mjs';
import { generateReplyBack } from '../lib/ai-commenter.mjs';
import { selectReplyCandidates, cleanReplyText } from '../lib/reply-back-plan.mjs';
import { getRecentPosts } from '../lib/post-history.mjs';
import {
  alreadyRepliedBack,
  markRepliedBack,
  repliedBackInLastHour,
  getMyReplyBacks,
  repliedBackCount,
  repliedBackCountForRoot,
} from '../lib/store.mjs';
import { sendAlert } from '../lib/telegram.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function getReplyBackConfig(cfg) {
  const rb = cfg.modeE?.replyBack || {};
  return {
    enabled: rb.enabled === true,
    ownUsername: (rb.ownUsername || cfg.modeB?.ownerUsername || '').replace(/^@/, ''),
    pollMinutes: rb.pollMinutes ?? 10,
    lookbackHours: rb.lookbackHours ?? 24,
    maxPerHour: rb.maxPerHour ?? 8,
    maxPerPost: rb.maxPerPost ?? 10,
    maxPerAuthorPerPost: rb.maxPerAuthorPerPost ?? 2,
    likeReplies: rb.likeReplies !== false,
    delayMinMs: rb.delayMinMs ?? 45_000,
    delayMaxMs: rb.delayMaxMs ?? 150_000,
    promptFile: rb.promptFile || 'prompts/reply_back.txt',
  };
}

async function fetchRepliesToMe(me, cookiesFile, pages = 2) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < pages; i++) {
    const { tweets, nextCursor } = await searchTimeline(`to:${me}`, cookiesFile, cursor, 'Latest');
    out.push(...tweets);
    if (!nextCursor || tweets.length === 0) break;
    cursor = nextCursor;
  }
  return out;
}

async function tryLike(tweetId, cfg, log) {
  try {
    await favoriteTweet(tweetId, cfg.cookiesFile);
  } catch (e) {
    log(`[reply-back] like ${tweetId} failed: ${e.message}`);
    if (/RATE_LIMITED/.test(e.message)) throw e;
  }
}

/**
 * One reply-back cycle. Returns the number of replies posted.
 */
export async function runReplyBackMode(cfg, log) {
  const rb = getReplyBackConfig(cfg);
  if (!rb.ownUsername) {
    log('[reply-back] modeE.replyBack.ownUsername is not set. Skipping.');
    return 0;
  }

  // Tweets we own that people can reply to: our posts + our earlier reply-backs
  const posts = getRecentPosts(rb.lookbackHours);
  const contentByRoot = new Map(posts.map((p) => [p.tweetId, p.content]));
  const parents = new Map(posts.map((p) => [p.tweetId, p.tweetId]));
  for (const r of getMyReplyBacks(Date.now() - rb.lookbackHours * 3600_000)) {
    parents.set(r.myTweetId, r.rootId);
  }
  if (parents.size === 0) {
    log(`[reply-back] No own posts in the last ${rb.lookbackHours}h. Nothing to check.`);
    return 0;
  }

  let replies;
  try {
    replies = await fetchRepliesToMe(rb.ownUsername, cfg.cookiesFile);
  } catch (e) {
    log(`[reply-back] search failed: ${e.message}`);
    if (/RATE_LIMITED/.test(e.message)) return 0;
    throw e;
  }

  const candidates = selectReplyCandidates(replies, {
    me: rb.ownUsername,
    parents,
    isHandled: alreadyRepliedBack,
    countFor: repliedBackCount,
    countForRoot: repliedBackCountForRoot,
    maxPerAuthorPerPost: rb.maxPerAuthorPerPost,
    maxPerPost: rb.maxPerPost,
    lookbackHours: rb.lookbackHours,
    skipUsers: cfg.skipUsers,
  });
  if (candidates.length === 0) {
    log('[reply-back] No new replies on own posts.');
    return 0;
  }
  log(`[reply-back] ${candidates.length} new replies to handle.`);

  let posted = 0;
  for (const { tweet, rootId, action } of candidates) {
    const base = { replyId: tweet.id, rootId, author: tweet.author };
    try {
      if (action === 'ignore') {
        log(`[reply-back] ignore spam from @${tweet.author}: "${tweet.fullText.slice(0, 50)}"`);
        markRepliedBack(base);
        continue;
      }
      if (action === 'like') {
        if (rb.likeReplies) await tryLike(tweet.id, cfg, log);
        markRepliedBack(base);
        log(`[reply-back] liked @${tweet.author}: "${cleanReplyText(tweet.fullText).slice(0, 50)}"`);
        continue;
      }

      if (repliedBackInLastHour() >= rb.maxPerHour) {
        log(`[reply-back] hourly cap ${rb.maxPerHour} reached. Remaining replies wait for next cycle.`);
        break;
      }

      let text;
      try {
        text = await generateReplyBack({
          myPost: contentByRoot.get(rootId),
          theirReply: cleanReplyText(tweet.fullText),
          author: tweet.author,
          ai: cfg.ai,
          promptFile: rb.promptFile,
        });
      } catch (e) {
        log(`[reply-back] AI fail for ${tweet.id}: ${e.message}`);
        continue;
      }

      if (rb.likeReplies) await tryLike(tweet.id, cfg, log);
      const myTweetId = await postTweet(text, cfg.cookiesFile, { replyToId: tweet.id });
      markRepliedBack({ ...base, myTweetId: myTweetId === 'ok' ? `ok-${tweet.id}` : myTweetId });
      posted++;
      log(`[reply-back] OK answered @${tweet.author} on ${rootId}: "${text.slice(0, 60)}..."`);

      const ms = rb.delayMinMs + Math.floor(Math.random() * Math.max(1, rb.delayMaxMs - rb.delayMinMs));
      await sleep(ms);
    } catch (e) {
      log(`[reply-back] ${action} ${tweet.id} failed: ${e.message}`);
      if (/RATE_LIMITED/.test(e.message)) {
        await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] Reply-back rate limited (${e.message})`);
        return posted;
      }
      // Permanent X errors (reply restricted, deleted tweet, ...) — don't retry every cycle
      if (/X API Error/.test(e.message)) markRepliedBack(base);
    }
  }
  return posted;
}
