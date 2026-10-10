import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcp-'));
process.chdir(dir);
fs.mkdirSync('data');
const { addPost, getAllPosts } = await import(path.resolve(import.meta.dirname, '../src/lib/post-history.mjs'));
const { acquireLock } = await import(path.resolve(import.meta.dirname, '../src/lib/instance-lock.mjs'));

test('corrupt history is moved aside, not overwritten', () => {
  fs.writeFileSync('data/post-history.json', '[{"content":"a"},{"content":"b"');
  assert.deepStrictEqual(getAllPosts(), []);
  const aside = fs.readdirSync('data').filter((f) => f.startsWith('post-history.corrupt-'));
  assert.strictEqual(aside.length, 1);
  assert.match(fs.readFileSync(path.join('data', aside[0]), 'utf-8'), /"content":"b"/);
  addPost({ content: 'new', type: 's', postedAt: '2026-10-10T00:00:00Z', tweetId: '1' });
  assert.strictEqual(getAllPosts().length, 1);
  assert.ok(!fs.readdirSync('data').some((f) => f.endsWith('.tmp')));
});

test('lock blocks a second live process and clears a stale one', () => {
  const sleeper = spawnSync(process.execPath, ['-e', 'console.log(process.pid)']);
  const deadPid = Number(sleeper.stdout.toString().trim());
  fs.writeFileSync('data/bot.lock', String(deadPid));
  assert.deepStrictEqual(acquireLock(), { ok: true });

  fs.writeFileSync('data/other.lock', String(process.ppid));
  const r = acquireLock('data/other.lock');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.pid, process.ppid);
});
