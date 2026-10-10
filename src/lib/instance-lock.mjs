/**
 * Single-instance lock — stops a second bot process (e.g. the ONLOGON and
 * ONSTART scheduled tasks both firing, or `npm start` while the task runs)
 * from posting twice and racing on data/ files.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/**
 * Take the lock, or return the pid of the process already holding it.
 * @returns {{ ok: true } | { ok: false, pid: number }}
 */
export function acquireLock(lockPath = 'data/bot.lock') {
  const file = path.resolve(lockPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, String(process.pid), { flag: 'wx' });
      const release = () => {
        try {
          if (fs.readFileSync(file, 'utf-8').trim() === String(process.pid)) fs.unlinkSync(file);
        } catch {}
      };
      process.on('exit', release);
      return { ok: true };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(fs.readFileSync(file, 'utf-8').trim());
      // A lock written before the last reboot is stale even if its pid now
      // belongs to some other process.
      const bootedAt = Date.now() - os.uptime() * 1000;
      const fresh = fs.statSync(file).mtimeMs >= bootedAt;
      if (pid && pid !== process.pid && fresh && isAlive(pid)) return { ok: false, pid };
      // Stale lock from a crashed or killed run
      try { fs.unlinkSync(file); } catch {}
    }
  }
  return { ok: false, pid: NaN };
}
