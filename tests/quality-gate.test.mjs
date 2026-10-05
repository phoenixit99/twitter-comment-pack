import test from 'node:test';
import assert from 'node:assert';
import { checkDraft } from '../src/lib/quality-gate.mjs';

const BODY = '"Digital Credit trên Bitcoin" của Saylor nghe sang, nhưng bản chất vẫn là bán niềm tin vào BTC.';

test('rejects posts that start with a format label', () => {
  for (const label of ['HOT TAKE: ', 'Hot take - ', '🔥 HOT TAKE: ', 'Mini list: ', 'Câu hỏi thảo luận: ']) {
    const r = checkDraft(label + BODY, [], { requireQuestion: false });
    assert.strictEqual(r.pass, false, label);
  }
});

test('accepts the same post without the label', () => {
  assert.strictEqual(checkDraft(BODY, [], { requireQuestion: false }).pass, true);
});
