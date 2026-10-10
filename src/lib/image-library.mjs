/**
 * Image library for Mode E (modeE.imageLibrary) — attach one of YOUR OWN
 * images to an original post, instead of re-using the source tweet's media.
 *
 * Layout: <dir>/<pillar>/*.jpg|png|webp, falling back to <dir>/*.  Name files
 * after what they show ("pho-bo-sang.jpg"): the name is passed to the AI as a
 * hint so the text matches the picture.
 */
import fs from 'fs';
import path from 'path';

export const IMAGE_LIBRARY_DEFAULTS = {
  enabled: false,
  dir: 'data/images',
  chance: 1,
};

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

export function getImageLibraryConfig(cfg) {
  return { ...IMAGE_LIBRARY_DEFAULTS, ...(cfg.modeE?.imageLibrary || {}) };
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => IMAGE_EXT.test(f))
      .map((f) => path.join(dir, f))
      .sort();
  } catch {
    return [];
  }
}

/** Images for a pillar: <dir>/<pillar>/ first, else the top-level <dir>/. */
export function listImages(dir, pillarName) {
  const own = pillarName ? listDir(path.join(dir, pillarName)) : [];
  return own.length > 0 ? own : listDir(dir);
}

/** Prefer images never posted; once all are used, the least recently used. */
export function pickImage(files, usedOrder = [], rand = Math.random) {
  if (files.length === 0) return null;
  const used = new Set(usedOrder);
  const fresh = files.filter((f) => !used.has(f));
  if (fresh.length > 0) return fresh[Math.floor(rand() * fresh.length)];
  // usedOrder is oldest → newest; take the file whose LAST use is oldest
  const lastUse = new Map();
  usedOrder.forEach((f, i) => lastUse.set(f, i));
  return files.reduce((best, f) => (lastUse.get(f) < lastUse.get(best) ? f : best));
}

/** "data/images/food/pho-bo_sang.jpg" → "pho bo sang" */
export function imageHint(file) {
  return path.basename(file).replace(IMAGE_EXT, '').replace(/[-_]+/g, ' ').replace(/\s+\d+$/, '').trim();
}

/**
 * Pick the image for this post, or null (library off, empty, or chance roll).
 * @param {string[]} usedOrder mediaFile of past posts, oldest first
 */
export function chooseImage(cfg, pillarName, usedOrder, rand = Math.random) {
  const lib = getImageLibraryConfig(cfg);
  if (!lib.enabled) return null;
  if (rand() >= lib.chance) return null;
  return pickImage(listImages(lib.dir, pillarName), usedOrder, rand);
}
