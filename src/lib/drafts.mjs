/**
 * Draft store + pure helpers for Mode E approval (modeE.approval).
 *
 * With approval on, Mode E never posts on its own: it saves a draft, sends it
 * to Telegram with Đăng / Bỏ buttons, and a person decides. Replying to the
 * draft message with new text replaces the draft (the person is the author).
 *
 * State lives in data/drafts.json: { offset, drafts: [...] }.
 */
import fs from 'fs';
import path from 'path';

const DRAFTS_PATH = path.resolve('data/drafts.json');
const MAX_DRAFTS = 300;

export const APPROVAL_DEFAULTS = {
  enabled: false,
  expireMinutes: 720,
  pollSeconds: 30,
};

/** modeE.approval merged with defaults. */
export function getApprovalConfig(cfg) {
  return { ...APPROVAL_DEFAULTS, ...(cfg.modeE?.approval || {}) };
}

export function readDraftState(file = DRAFTS_PATH) {
  try {
    if (!fs.existsSync(file)) return { offset: 0, drafts: [] };
    const s = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { offset: s.offset || 0, drafts: Array.isArray(s.drafts) ? s.drafts : [] };
  } catch {
    return { offset: 0, drafts: [] };
  }
}

export function writeDraftState(state, file = DRAFTS_PATH) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const drafts = state.drafts.slice(-MAX_DRAFTS);
  fs.writeFileSync(file, JSON.stringify({ offset: state.offset || 0, drafts }, null, 2), 'utf-8');
}

/** A draft already exists for this slot today (any status), so don't draft again. */
export function hasDraftInSlot(drafts, slotName, date) {
  return drafts.some((d) => d.type === slotName && (d.createdAt || '').startsWith(date));
}

export function newDraftId(now = Date.now(), rand = Math.random) {
  return `${now.toString(36)}${Math.floor(rand() * 1296).toString(36).padStart(2, '0')}`;
}

/** Text shown in Telegram for a draft. */
export function draftMessageText(d) {
  return `📝 Nháp [${d.type} · ${d.pillar}${d.format ? ' · ' + d.format : ''}]\n\n${d.content}\n\n` +
    'Bấm Đăng hoặc Bỏ. Muốn sửa: trả lời (reply) tin nhắn này bằng nội dung mới.';
}

export function draftKeyboard(d) {
  return {
    inline_keyboard: [[
      { text: '✅ Đăng', callback_data: `post:${d.id}` },
      { text: '🗑 Bỏ', callback_data: `drop:${d.id}` },
    ]],
  };
}

/**
 * Decide what a Telegram update means. Only the configured chat is obeyed.
 * @returns {{ action: 'post'|'drop'|'edit'|'ignore', draft?: object, text?: string, callbackId?: string, reason?: string }}
 */
export function planUpdate(update, { chatId, drafts }) {
  const allowed = String(chatId || '');
  const cb = update.callback_query;
  if (cb) {
    const fromChat = String(cb.message?.chat?.id ?? '');
    if (!allowed || fromChat !== allowed) return { action: 'ignore', callbackId: cb.id, reason: 'chat' };
    const m = /^(post|drop):(.+)$/.exec(cb.data || '');
    if (!m) return { action: 'ignore', callbackId: cb.id, reason: 'data' };
    const draft = drafts.find((d) => d.id === m[2]);
    if (!draft) return { action: 'ignore', callbackId: cb.id, reason: 'unknown' };
    if (draft.status !== 'pending') return { action: 'ignore', callbackId: cb.id, draft, reason: draft.status };
    return { action: m[1], draft, callbackId: cb.id };
  }

  const msg = update.message;
  if (msg) {
    if (!allowed || String(msg.chat?.id ?? '') !== allowed) return { action: 'ignore', reason: 'chat' };
    const repliedId = msg.reply_to_message?.message_id;
    const text = (msg.text || '').trim();
    if (!repliedId || !text) return { action: 'ignore', reason: 'not_reply' };
    const draft = drafts.find((d) => d.telegramMessageId === repliedId);
    if (!draft) return { action: 'ignore', reason: 'unknown' };
    if (draft.status !== 'pending') return { action: 'ignore', draft, reason: draft.status };
    return { action: 'edit', draft, text };
  }

  return { action: 'ignore', reason: 'other' };
}

/** Pending drafts older than expireMinutes. */
export function expiredDrafts(drafts, expireMinutes, now = Date.now()) {
  const cutoff = now - expireMinutes * 60_000;
  return drafts.filter((d) => d.status === 'pending' && Date.parse(d.createdAt) < cutoff);
}

// Each helper below is a synchronous read-modify-write, so the post loop and
// the approval loop (both async in one process) never overwrite each other.

export function addDraft(draft, file = DRAFTS_PATH) {
  const s = readDraftState(file);
  s.drafts.push(draft);
  writeDraftState(s, file);
}

export function patchDraft(id, patch, file = DRAFTS_PATH) {
  const s = readDraftState(file);
  const d = s.drafts.find((x) => x.id === id);
  if (d) Object.assign(d, patch);
  writeDraftState(s, file);
  return d;
}

export function setUpdateOffset(offset, file = DRAFTS_PATH) {
  const s = readDraftState(file);
  s.offset = Math.max(s.offset || 0, offset);
  writeDraftState(s, file);
}
