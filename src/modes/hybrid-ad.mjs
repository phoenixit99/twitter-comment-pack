/**
 * Mode E — alternate Mode A (List Comment) and Mode D (Auto Post) every iteration.
 */
import { runListMode } from './list-comment.mjs';
import { runAutoPostMode } from './auto-post.mjs';
import { getMeta, setMeta } from '../lib/store.mjs';

export async function runHybridADMode(cfg, log) {
  const last = getMeta('hybrid_ad_last') || 'D';
  if (last === 'D') {
    log('[mode-E] running A');
    await runListMode(cfg, log);
    setMeta('hybrid_ad_last', 'A');
  } else {
    log('[mode-E] running D');
    await runAutoPostMode(cfg, log);
    setMeta('hybrid_ad_last', 'D');
  }
}
