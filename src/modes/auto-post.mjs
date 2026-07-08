/**
 * Mode D — Auto Post based on list scan
 * Crawls lists, finds top engaged tweets, uses them as inspiration to write a new post.
 */
import { fetchListTweets, postTweet, uploadImageFromUrl } from '../lib/twitter-http.mjs';
import { detectLanguage } from '../lib/language.mjs';
import { generatePost } from '../lib/ai-commenter.mjs';
import { alreadyCommented, markPosted, alreadyPosted } from '../lib/store.mjs';
import { waitForPostSlot, postSleep } from '../lib/rate-limiter.mjs';
import { sendAlert } from '../lib/telegram.mjs';

export async function runAutoPostMode(cfg, log) {
  const isReady = await waitForPostSlot(cfg, log);
  if (!isReady) return false;

  const listIds = cfg.modeD?.listIds || [];
  if (listIds.length === 0) {
    log('[mode-D] no list IDs configured; skipping');
    return false;
  }

  const pool = [];
  const seen = new Set();
  for (const id of listIds) {
    try {
      const tweets = await fetchListTweets(String(id).trim(), cfg.cookiesFile, 30);
      for (const t of tweets) {
        if (!t.id || !t.fullText || t.fullText.length < 10) continue;
        if (t.isRetweet) continue;
        if (seen.has(t.id)) continue;
        if (alreadyCommented(t.id) || alreadyPosted(t.id)) continue;

        // Skip tweets that do not have any media or URL attachments
        const hasMedia = t.mediaUrls && t.mediaUrls.length > 0;
        const hasUrls = t.urls && t.urls.length > 0;
        if (!hasMedia && !hasUrls) continue;

        seen.add(t.id);
        pool.push(t);
      }
      log(`[mode-D] list ${id}: pool size now ${pool.length}`);
    } catch (e) {
      log(`[mode-D] list ${id} fetch failed: ${e.message}`);
      if (/401|403/.test(e.message)) {
        await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] Session expired — re-export cookies`);
        throw e;
      }
    }
  }

  // Sort by favoriteCount descending (highest engagement first)
  pool.sort((a, b) => {
    if (b.favoriteCount !== a.favoriteCount) {
      return (b.favoriteCount || 0) - (a.favoriteCount || 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  for (const t of pool) {
    const langSetting = cfg.modeD?.language || 'auto';
    const lang = langSetting === 'auto' ? detectLanguage(t.fullText) : langSetting;

    let postContent;
    try {
      postContent = await generatePost({
        tweetText: t.fullText,
        lang,
        style: cfg.modeD?.stylePrompt || '',
        ai: cfg.ai,
      });
    } catch (e) {
      log(`[mode-D] AI fail for ${t.id}: ${e.message}`);
      continue;
    }

    let mediaIds = [];
    if (t.mediaUrls && t.mediaUrls.length > 0) {
      log(`[mode-D] Inspiration tweet has ${t.mediaUrls.length} image(s). Uploading...`);
      for (const imgUrl of t.mediaUrls) {
        try {
          const mId = await uploadImageFromUrl(imgUrl, cfg.cookiesFile);
          if (mId) mediaIds.push(mId);
        } catch (e) {
          log(`[mode-D] Failed to upload image ${imgUrl}: ${e.message}`);
        }
      }
    }

    try {
      await postTweet(postContent, cfg.cookiesFile, { mediaIds });
      markPosted(t.id, t.author);
      log(`[mode-D] OK auto-post inspired by ${t.id} @${t.author} lang=${lang} "${postContent.slice(0, 60)}..."`);
      return true; // Only one post per cycle
    } catch (e) {
      log(`[mode-D] post fail for inspiration ${t.id}: ${e.message}`);
      if (/RATE_LIMITED/.test(e.message)) {
        await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] Rate limited (${e.message})`);
        return false;
      }
      continue;
    }
    await postSleep(cfg, log);
  }
  return false;
}
