import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  planUpdate, hasDraftInSlot, expiredDrafts, getApprovalConfig,
  addDraft, patchDraft, setUpdateOffset, readDraftState,
} from '../src/lib/drafts.mjs';

const drafts = [
  { id: 'a1', status: 'pending', telegramMessageId: 10, type: 'morning', createdAt: '2026-10-10T01:00:00Z' },
  { id: 'b2', status: 'posted', telegramMessageId: 11, type: 'noon', createdAt: '2026-10-10T05:00:00Z' },
];
const ctx = { chatId: '123', drafts };
const cb = (data, chat = 123) => ({ update_id: 1, callback_query: { id: 'q', data, message: { chat: { id: chat } } } });
const reply = (to, text, chat = 123) => ({ update_id: 2, message: { chat: { id: chat }, text, reply_to_message: { message_id: to } } });

test('buttons from the configured chat post or drop a pending draft', () => {
  assert.strictEqual(planUpdate(cb('post:a1'), ctx).action, 'post');
  assert.strictEqual(planUpdate(cb('drop:a1'), ctx).action, 'drop');
  assert.strictEqual(planUpdate(cb('post:a1'), ctx).draft.id, 'a1');
});

test('other chats, unknown drafts and decided drafts are ignored', () => {
  assert.deepStrictEqual(
    [planUpdate(cb('post:a1', 999), ctx).reason, planUpdate(cb('post:zz'), ctx).reason, planUpdate(cb('post:b2'), ctx).reason],
    ['chat', 'unknown', 'posted'],
  );
  assert.strictEqual(planUpdate(cb('post:a1'), { chatId: '', drafts }).action, 'ignore');
});

test('a reply to the draft message edits it', () => {
  const p = planUpdate(reply(10, '  Bản sửa của mình  '), ctx);
  assert.strictEqual(p.action, 'edit');
  assert.strictEqual(p.text, 'Bản sửa của mình');
  assert.strictEqual(planUpdate(reply(10, 'x', 5), ctx).action, 'ignore');
  assert.strictEqual(planUpdate(reply(11, 'x'), ctx).reason, 'posted');
  assert.strictEqual(planUpdate({ update_id: 3, message: { chat: { id: 123 }, text: 'hi' } }, ctx).reason, 'not_reply');
});

test('slot and expiry helpers', () => {
  assert.ok(hasDraftInSlot(drafts, 'morning', '2026-10-10'));
  assert.ok(!hasDraftInSlot(drafts, 'evening', '2026-10-10'));
  const now = Date.parse('2026-10-10T13:30:00Z');
  assert.deepStrictEqual(expiredDrafts(drafts, 720, now).map((d) => d.id), ['a1']);
  assert.deepStrictEqual(expiredDrafts(drafts, 1000, now), []);
});

test('approval is off unless configured', () => {
  assert.strictEqual(getApprovalConfig({}).enabled, false);
  assert.strictEqual(getApprovalConfig({ modeE: { approval: { enabled: true } } }).expireMinutes, 720);
});

test('store helpers read-modify-write without losing drafts', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'drafts-')), 'drafts.json');
  addDraft({ id: 'x', status: 'pending' }, file);
  addDraft({ id: 'y', status: 'pending' }, file);
  patchDraft('x', { status: 'posted' }, file);
  setUpdateOffset(5, file);
  setUpdateOffset(3, file);
  const s = readDraftState(file);
  assert.strictEqual(s.offset, 5);
  assert.deepStrictEqual(s.drafts.map((d) => `${d.id}:${d.status}`), ['x:posted', 'y:pending']);
});
