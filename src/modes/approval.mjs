/**
 * Mode E approval loop (modeE.approval.enabled).
 *
 * Mode E saves drafts instead of posting (see autonomous-post.mjs). This loop
 * sends each new draft to Telegram with Đăng / Bỏ buttons, long-polls
 * getUpdates, and only posts to X when the configured chat presses Đăng.
 * Replying to a draft message with new text replaces the draft.
 */
import { postTweet, uploadImageFromUrl } from '../lib/twitter-http.mjs';
import { telegramCall } from '../lib/telegram.mjs';
import { addPost } from '../lib/post-history.mjs';
import {
  getApprovalConfig, readDraftState, patchDraft, setUpdateOffset, planUpdate,
  expiredDrafts, draftMessageText, draftKeyboard,
} from '../lib/drafts.mjs';

/** Send drafts that have not reached Telegram yet. */
async function sendNewDrafts(cfg, log) {
  const { botToken, chatId } = cfg.telegram;
  for (const d of readDraftState().drafts) {
    if (d.status !== 'pending' || d.telegramMessageId) continue;
    const msg = await telegramCall(botToken, 'sendMessage', {
      chat_id: chatId,
      text: draftMessageText(d),
      reply_markup: draftKeyboard(d),
      disable_web_page_preview: true,
    });
    patchDraft(d.id, { telegramMessageId: msg.message_id });
    log(`[approval] draft ${d.id} sent to Telegram`);
  }
}

async function closeMessage(cfg, d, note) {
  if (!d.telegramMessageId) return;
  try {
    await telegramCall(cfg.telegram.botToken, 'editMessageText', {
      chat_id: cfg.telegram.chatId,
      message_id: d.telegramMessageId,
      text: `${note}\n\n${d.content}`,
      disable_web_page_preview: true,
    });
  } catch {
    // message too old or unchanged — not worth failing over
  }
}

async function publishDraft(cfg, d, log) {
  const mediaIds = [];
  for (const url of d.mediaUrls || []) {
    try {
      const id = await uploadImageFromUrl(url, cfg.cookiesFile);
      if (id) mediaIds.push(id);
    } catch (e) {
      log(`[approval] image upload failed ${url}: ${e.message}`);
    }
  }
  const tweetId = await postTweet(d.content, cfg.cookiesFile, { mediaIds });
  addPost({
    content: d.content,
    type: d.type,
    pillar: d.pillar,
    format: d.format,
    topic: d.topic,
    sourceTweetId: d.sourceTweetId,
    postedAt: new Date().toISOString(),
    tweetId,
    approved: true,
    edited: Boolean(d.edited),
  });
  return tweetId;
}

/** One pass: expire, send new drafts, wait for button presses / edits. */
export async function runApprovalOnce(cfg, log) {
  const ap = getApprovalConfig(cfg);
  const { botToken, chatId } = cfg.telegram || {};

  for (const d of expiredDrafts(readDraftState().drafts, ap.expireMinutes)) {
    patchDraft(d.id, { status: 'expired' });
    await closeMessage(cfg, d, '⌛ Hết hạn, không đăng.');
    log(`[approval] draft ${d.id} expired`);
  }

  await sendNewDrafts(cfg, log);

  const updates = await telegramCall(botToken, 'getUpdates', {
    offset: readDraftState().offset,
    timeout: ap.pollSeconds,
    allowed_updates: ['message', 'callback_query'],
  });

  for (const u of updates) {
    setUpdateOffset(u.update_id + 1);
    // Fresh read: the post loop may have added drafts during the long poll
    const plan = planUpdate(u, { chatId, drafts: readDraftState().drafts });
    const answer = async (text) => {
      if (!plan.callbackId) return;
      try { await telegramCall(botToken, 'answerCallbackQuery', { callback_query_id: plan.callbackId, text }); } catch {}
    };

    if (plan.action === 'post') {
      const d = plan.draft;
      patchDraft(d.id, { status: 'posting' });
      try {
        const tweetId = await publishDraft(cfg, d, log);
        patchDraft(d.id, { status: 'posted', tweetId, decidedAt: new Date().toISOString() });
        await answer('Đã đăng');
        await closeMessage(cfg, d, `✅ Đã đăng (tweet ${tweetId}).`);
        log(`[approval] draft ${d.id} posted as ${tweetId}`);
      } catch (e) {
        patchDraft(d.id, { status: 'pending' });
        await answer('Đăng lỗi, thử lại sau');
        log(`[approval] post failed for ${d.id}: ${e.message}`);
      }
    } else if (plan.action === 'drop') {
      patchDraft(plan.draft.id, { status: 'dropped', decidedAt: new Date().toISOString() });
      await answer('Đã bỏ');
      await closeMessage(cfg, plan.draft, '🗑 Đã bỏ.');
      log(`[approval] draft ${plan.draft.id} dropped`);
    } else if (plan.action === 'edit') {
      await closeMessage(cfg, plan.draft, '✏️ Đã sửa, xem bản mới bên dưới.');
      // telegramMessageId cleared → re-sent with buttons below
      patchDraft(plan.draft.id, { content: plan.text, edited: true, telegramMessageId: null });
      log(`[approval] draft ${plan.draft.id} edited`);
    } else {
      await answer(plan.reason === 'posted' ? 'Bài này đã đăng rồi' : 'Không xử lý được');
    }
  }

  await sendNewDrafts(cfg, log);
}
