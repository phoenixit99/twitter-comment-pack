/**
 * Test auto-post immediately — bypasses schedule slot check.
 * Usage: node test-auto-post.mjs
 */
import { loadConfig } from './src/config.mjs';
import { initStore } from './src/lib/store.mjs';
import { fetchListTweets, postTweet, uploadImageFromUrl } from './src/lib/twitter-http.mjs';
import { generateCryptoOriginal } from './src/lib/ai-commenter.mjs';
import { checkDraft } from './src/lib/quality-gate.mjs';
import { getRecentOpenings, addPost } from './src/lib/post-history.mjs';

const cfg = loadConfig();
initStore('data/store.db');

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

log('=== TEST AUTO-POST (no schedule check) ===');

// 1. Fetch tweets from modeE lists
const listIds = cfg.modeE?.listIds || cfg.modeA?.listIds || [];
log(`Fetching from ${listIds.length} lists...`);

let pool = [];
for (const id of listIds) {
  try {
    const tweets = await fetchListTweets(String(id).trim(), cfg.cookiesFile, 15);
    for (const t of tweets) {
      if (!t.id || !t.fullText || t.fullText.length < 20) continue;
      if (t.isRetweet) continue;
      pool.push(t);
    }
    log(`List ${id}: got ${tweets.length} tweets, pool=${pool.length}`);
  } catch (e) {
    log(`List ${id} failed: ${e.message}`);
  }
}

if (pool.length === 0) {
  console.error('No tweets fetched. Check cookies/list IDs.');
  process.exit(1);
}

// 2. Pick top tweet as context
pool.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
const topTweets = pool.slice(0, 5);
const selected = topTweets[Math.floor(Math.random() * topTweets.length)];
log(`Selected context: @${selected.author} (${selected.favoriteCount} likes): "${selected.fullText.slice(0, 80)}..."`);

const researchContext = `TIN TỨC GẦN ĐÂY TỪ TÀI KHOẢN @${selected.author}:\n${selected.fullText}`;

// 3. Generate post
const recentOpenings = getRecentOpenings(5);
log('Generating post via AI...');

let postContent;
try {
  postContent = await generateCryptoOriginal({
    postType: 'midday_news',
    topic: '',
    researchContext,
    recentOpenings,
    ai: cfg.ai
  });
} catch (e) {
  console.error('AI generation failed:', e.message);
  process.exit(1);
}

log(`Generated: "${postContent}"`);
log(`Length: ${postContent.length} chars`);

// 4. Quality gate
const check = checkDraft(postContent, recentOpenings);
if (!check.pass) {
  console.error('Quality gate FAILED:', check.reasons.join(', '));
  console.error('Post content:', postContent);
  process.exit(1);
}
log('Quality gate: PASSED ✅');

// 5. Upload media if the contextual tweet had any
let mediaIds = [];
if (selected.mediaUrls && selected.mediaUrls.length > 0) {
  log(`Context tweet has ${selected.mediaUrls.length} image(s). Uploading...`);
  for (const imgUrl of selected.mediaUrls) {
    try {
      const mId = await uploadImageFromUrl(imgUrl, cfg.cookiesFile);
      if (mId) mediaIds.push(mId);
    } catch (e) {
      log(`Failed to upload image ${imgUrl}: ${e.message}`);
    }
  }
}

// 6. Post to Twitter
log('Posting to Twitter...');
try {
  const tweetId = await postTweet(postContent, cfg.cookiesFile, { mediaIds });
  log(`✅ Posted! Tweet ID: ${tweetId}`);
  
  addPost({
    content: postContent,
    type: 'test',
    postedAt: new Date().toISOString(),
    tweetId
  });
  
  log('Saved to post history.');
} catch (e) {
  console.error('Post failed:', e.message);
  process.exit(1);
}

process.exit(0);
