import { postTweet } from '../lib/twitter-http.mjs';
import { generateCryptoOriginal } from '../lib/ai-commenter.mjs';
import { getPostScheduleSlot, msUntilNextSlot, postSleep } from '../lib/rate-limiter.mjs';
import { sendAlert } from '../lib/telegram.mjs';
import { checkDraft } from '../lib/quality-gate.mjs';
import { getRecentOpenings, addPost, hasPostedInSlot } from '../lib/post-history.mjs';

export async function runAutonomousPostMode(cfg, log) {
  // 1. Check schedule slot
  const slotName = getPostScheduleSlot(cfg);
  if (!slotName) {
    const msWait = msUntilNextSlot(cfg);
    log(`[mode-E] Outside posting slots. Next check in ~${Math.round(msWait / 60000)}m`);
    return msWait; // Return how long to sleep
  }

  // 2. Check if already posted for this slot today
  const todayDate = new Date().toISOString().split('T')[0];
  if (hasPostedInSlot(slotName, todayDate)) {
    log(`[mode-E] Already posted for slot "${slotName}" today. Waiting for next slot.`);
    const msWait = msUntilNextSlot(cfg);
    return msWait;
  }

  const maxRetries = cfg.modeE?.maxRetries || 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    log(`[mode-E] Slot "${slotName}" active. Generating post (Attempt ${attempt}/${maxRetries})...`);

    // 3. Choose Topic
    const topics = cfg.modeE?.topics || ['BTC', 'ETH', 'SOL', 'crypto market'];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    
    // Optional: Search Tavily if key is provided (skipping for brevity, can be re-added)
    const researchContext = `Recent updates on ${topic}.`;

    // 4. Generate Draft (2-pass)
    const recentOpenings = getRecentOpenings(5);
    let postContent = '';
    
    try {
      postContent = await generateCryptoOriginal({
        postType: slotName,
        topic,
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
      if (attempt >= maxRetries) {
        log(`[mode-E] Max retries reached. Skipping slot.`);
        return 15 * 60000;
      }
      continue;
    }

    // 6. Post to Twitter
    try {
      const tweetId = await postTweet(postContent, cfg.cookiesFile, { mediaIds: [] });
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
      
      // We successfully posted, return a value indicating we should trigger a comment pause
      return 'POSTED';
      
    } catch (e) {
      log(`[mode-E] Post failed: ${e.message}`);
      if (/RATE_LIMITED/.test(e.message)) {
        await sendAlert(cfg.telegram?.botToken, cfg.telegram?.chatId, `[twitter-comment-pack] Rate limited (${e.message})`);
        return 60 * 60000; // Sleep an hour
      }
      // If other failure, maybe retry
      if (attempt >= maxRetries) return 15 * 60000;
    }
  }
  
  return 15 * 60000;
}
