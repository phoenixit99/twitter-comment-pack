/**
 * Mode D — Auto Post based on list scan
 * Crawls lists, finds top engaged tweets, uses them as inspiration to write a new post.
 */
import { fetchListTweets, postTweet } from '../lib/twitter-http.mjs';
import { detectLanguage } from '../lib/language.mjs';
import { generatePost } from '../lib/ai-commenter.mjs';
import { alreadyCommented, markCommented } from '../lib/store.mjs';
import { waitForSlot, postSleep } from '../lib/rate-limiter.mjs';
import { sendAlert } from '../lib/telegram.mjs';

export async function runAutoPostMode(cfg, log) {
  const listIds = cfg.modeD?.listIds || [];
  if (listIds.length === 0) {
    log('[mode-D] no list IDs configured; skipping');
    return;
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
        if (alreadyCommented(t.id)) continue;
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
    await waitForSlot(cfg, log);
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

    try {
      await postTweet(postContent, cfg.cookiesFile, {});
      markCommented(t.id, t.author);
      log(`[mode-D] OK auto-post inspired by ${t.id} @${t.author} lang=${lang} "${postContent.slice(0, 60)}..."`);
    } catch (e) {
      log(`[mode-D] post fail for inspiration ${t.id}: ${e.message}`);
      if (/RATE_LIMITED/.test(e.message)) {
        await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] Rate limited (${e.message})`);
        return;
      }
      continue;
    }
    await postSleep(cfg, log);
  }
}
