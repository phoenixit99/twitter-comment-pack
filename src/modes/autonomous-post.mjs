import { postTweet, fetchListTweets, uploadImageFromUrl } from '../lib/twitter-http.mjs';
import { generateCryptoOriginal } from '../lib/ai-commenter.mjs';
import { getPostScheduleSlot, msUntilNextSlot } from '../lib/rate-limiter.mjs';
import { sendAlert } from '../lib/telegram.mjs';
import { checkDraft } from '../lib/quality-gate.mjs';
import { getRecentOpenings, addPost, hasPostedInSlot } from '../lib/post-history.mjs';

export async function runAutonomousPostMode(cfg, log) {
  // 1. Check schedule slot
  const slotName = getPostScheduleSlot(cfg);
  if (!slotName) {
    const msWait = msUntilNextSlot(cfg);
    log(`[mode-E] Outside posting slots. Next check in ~${Math.round(msWait / 60000)}m`);
    return msWait;
  }

  // 2. Check if already posted for this slot today
  const todayDate = new Date().toISOString().split('T')[0];
  if (hasPostedInSlot(slotName, todayDate)) {
    log(`[mode-E] Already posted for slot "${slotName}" today. Waiting for next slot.`);
    return msUntilNextSlot(cfg);
  }

  const maxRetries = cfg.modeE?.maxRetries || 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    log(`[mode-E] Slot "${slotName}" active. Generating post (Attempt ${attempt}/${maxRetries})...`);

    // 3. Fetch Hot Tweets from Lists for Research Context
    const listIds = cfg.modeE?.listIds || cfg.modeA?.listIds || [];
    if (listIds.length === 0) {
      log('[mode-E] No list IDs configured for fetching context. Skipping.');
      return 15 * 60000;
    }

    let pool = [];
    for (const id of listIds) {
      try {
        const tweets = await fetchListTweets(String(id).trim(), cfg.cookiesFile, 15);
        for (const t of tweets) {
          if (!t.id || !t.fullText || t.fullText.length < 20) continue;
          if (t.isRetweet) continue;
          pool.push(t);
        }
      } catch (e) {
        log(`[mode-E] list ${id} fetch failed: ${e.message}`);
      }
    }

    if (pool.length === 0) {
      log('[mode-E] Could not fetch any tweets for context. Retrying later.');
      return 15 * 60000;
    }

    // Sort by favoriteCount descending (highest engagement first)
    pool.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
    
    // Pick one of the top 5 hot tweets randomly to ensure variety
    const topTweets = pool.slice(0, 5);
    const selectedTweet = topTweets[Math.floor(Math.random() * topTweets.length)];
    
    log(`[mode-E] Selected context from @${selectedTweet.author}: "${selectedTweet.fullText.slice(0, 40)}..."`);
    const researchContext = `TIN TỨC GẦN ĐÂY TỪ TÀI KHOẢN @${selectedTweet.author}:\n${selectedTweet.fullText}`;

    // 4. Generate Draft (2-pass)
    const recentOpenings = getRecentOpenings(5);
    let postContent = '';
    
    try {
      postContent = await generateCryptoOriginal({
        postType: slotName,
        topic: '',
        researchContext,
        recentOpenings,
        ai: cfg.ai
      });
    } catch (e) {
      log(`[mode-E] Generation failed: ${e.message}`);
      if (attempt >= maxRetries) return 15 * 60000;
      continue;
    }

    // 5. Quality Gate
    const checkResult = checkDraft(postContent, recentOpenings);
    if (!checkResult.pass) {
      log(`[mode-E] Quality check failed: ${checkResult.reasons.join(', ')}`);
      log(`[mode-E] Rejected content: ${postContent.replace(/\n/g, ' ')}`);
      if (attempt >= maxRetries) return 15 * 60000;
      continue;
    }

    // 6. Upload media if the contextual tweet had any
    let mediaIds = [];
    if (selectedTweet.mediaUrls && selectedTweet.mediaUrls.length > 0) {
      log(`[mode-E] Context tweet has ${selectedTweet.mediaUrls.length} image(s). Uploading...`);
      for (const imgUrl of selectedTweet.mediaUrls) {
        try {
          const mId = await uploadImageFromUrl(imgUrl, cfg.cookiesFile);
          if (mId) mediaIds.push(mId);
        } catch (e) {
          log(`[mode-E] Failed to upload image ${imgUrl}: ${e.message}`);
        }
      }
    }

    // 7. Post to Twitter
    try {
      const tweetId = await postTweet(postContent, cfg.cookiesFile, { mediaIds });
      log(`[mode-E] OK auto-posted tweet ${tweetId} "${postContent.slice(0, 60)}..."`);
      
      // 7. Save to history
      addPost({
        content: postContent,
        type: slotName,
        postedAt: new Date().toISOString(),
        tweetId
      });

      // 8. Telegram alert
      await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `🪙 Bài gốc đã đăng [${slotName}]:\n\n${postContent}`);
      
      return 'POSTED';
      
    } catch (e) {
      log(`[mode-E] Post failed: ${e.message}`);
      if (/RATE_LIMITED/.test(e.message)) {
        await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] Rate limited (${e.message})`);
        return 60 * 60000; // Sleep an hour
      }
      if (attempt >= maxRetries) return 15 * 60000;
    }
  }
  
  return 15 * 60000;
}
