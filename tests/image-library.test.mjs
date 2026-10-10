import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listImages, pickImage, imageHint, chooseImage } from '../src/lib/image-library.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imglib-'));
fs.mkdirSync(path.join(dir, 'food'));
for (const f of ['food/pho-bo_sang.jpg', 'food/com-trung.png', 'food/notes.txt', 'walk-toi.webp']) {
  fs.writeFileSync(path.join(dir, f), 'x');
}

test('pillar folder first, then the top-level folder; images only', () => {
  assert.deepStrictEqual(listImages(dir, 'food').map((f) => path.basename(f)), ['com-trung.png', 'pho-bo_sang.jpg']);
  assert.deepStrictEqual(listImages(dir, 'gym').map((f) => path.basename(f)), ['walk-toi.webp']);
  assert.deepStrictEqual(listImages(path.join(dir, 'missing'), 'food'), []);
});

test('unused images first, then the least recently used', () => {
  assert.strictEqual(pickImage(['a', 'b', 'c'], ['a', 'c'], () => 0), 'b');
  assert.strictEqual(pickImage(['a', 'b'], ['a', 'b', 'a'], () => 0), 'b');
  assert.strictEqual(pickImage([], []), null);
});

test('file name becomes a hint for the text', () => {
  assert.strictEqual(imageHint('data/x/pho-bo_sang.jpg'), 'pho bo sang');
  assert.strictEqual(imageHint('gym-tai-nha-2.png'), 'gym tai nha');
});

test('chooseImage respects enabled and chance', () => {
  const on = { modeE: { imageLibrary: { enabled: true, dir, chance: 0.5 } } };
  assert.strictEqual(chooseImage({}, 'food', [], () => 0), null);
  assert.strictEqual(chooseImage(on, 'food', [], () => 0.9), null);
  assert.ok(chooseImage(on, 'food', [], () => 0.1).endsWith('.png'));
});
