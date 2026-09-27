/**
 * Content plan for Mode E — decides WHAT to post in a slot:
 *   - pillar  (crypto, ai_tech, ...) → which lists to research + which prompt file
 *   - topic   (random from the pillar's topics)
 *   - format  (hot take, question, mini list, ...) → varies structure so the
 *             feed does not look like the same template 10 times a day
 *
 * Pure functions only (no network / fs) so they are easy to test.
 */

export const DEFAULT_PROMPT_FILE = 'prompts/post_original.txt';

export const DEFAULT_FORMATS = [
  {
    name: 'hot_take',
    weight: 3,
    requireQuestion: false,
    instruction: 'HOT TAKE: 1 nhận định rõ ràng, có lập trường (đồng ý hoặc phản biện số đông), kèm 1 lý do cụ thể hoặc 1 con số. Không cần kết bằng câu hỏi.',
  },
  {
    name: 'question',
    weight: 2,
    requireQuestion: true,
    instruction: 'CÂU HỎI THẢO LUẬN: nêu bối cảnh ngắn rồi kết bằng 1 câu hỏi cụ thể, dễ trả lời (chọn A hay B, con số dự đoán, kinh nghiệm cá nhân). Câu cuối PHẢI kết thúc bằng dấu "?".',
  },
  {
    name: 'mini_list',
    weight: 2,
    requireQuestion: false,
    instruction: 'MINI LIST: 1 dòng hook + 3 gạch đầu dòng ngắn (mỗi dòng 1 ý: tip, tool, bài học hoặc số liệu). Xuống dòng giữa các ý. Được phép dài tới 280 ký tự.',
  },
  {
    name: 'explain_simple',
    weight: 2,
    requireQuestion: false,
    instruction: 'GIẢI THÍCH DỄ HIỂU: giải thích 1 khái niệm/tin trong bài bằng ví dụ đời thường cho người mới, như đang nói với bạn thân. Không thuật ngữ khó.',
  },
  {
    name: 'personal_story',
    weight: 1,
    requireQuestion: false,
    instruction: 'TRẢI NGHIỆM CÁ NHÂN: kể ngắn 1 trải nghiệm/sai lầm/bài học ở ngôi thứ nhất liên quan đến tin, giọng thật, không khoe khoang.',
  },
];

/**
 * Normalise config into a list of pillars. When `modeE.pillars` is absent,
 * fall back to a single implicit pillar built from the legacy fields so old
 * configs keep working unchanged.
 */
export function getPillars(cfg) {
  const e = cfg.modeE || {};
  if (Array.isArray(e.pillars) && e.pillars.length > 0) {
    return e.pillars.map((p) => ({
      name: p.name,
      weight: typeof p.weight === 'number' ? p.weight : 1,
      listIds: p.listIds && p.listIds.length ? p.listIds : (e.listIds || cfg.modeA?.listIds || []),
      topics: p.topics || [],
      promptFile: p.promptFile || DEFAULT_PROMPT_FILE,
      formats: p.formats || null,
    }));
  }
  return [{
    name: 'default',
    weight: 1,
    listIds: e.listIds || cfg.modeA?.listIds || [],
    topics: e.topics || [],
    promptFile: DEFAULT_PROMPT_FILE,
    formats: null,
  }];
}

export function weightedPick(items, rand = Math.random) {
  const valid = items.filter((i) => (i.weight ?? 1) > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = rand() * total;
  for (const i of valid) {
    r -= i.weight ?? 1;
    if (r < 0) return i;
  }
  return valid[valid.length - 1];
}

/**
 * Choose the pillar for a slot. A slot may pin a pillar with `"pillar": "ai_tech"`.
 */
export function pickPillar(cfg, slotName, rand = Math.random) {
  const pillars = getPillars(cfg);
  const slot = (cfg.modeE?.schedule?.slots || []).find((s) => s.name === slotName);
  if (slot?.pillar) {
    const pinned = pillars.find((p) => p.name === slot.pillar);
    if (pinned) return pinned;
  }
  return weightedPick(pillars, rand);
}

/**
 * Choose a format, avoiding the one used for the previous post.
 * Prompts without a {{FORMAT}} placeholder keep the legacy behaviour
 * (question required) — see generateCryptoOriginal.
 */
export function pickFormat(cfg, pillar, lastFormat, rand = Math.random) {
  const formats = pillar?.formats || cfg.modeE?.formats || DEFAULT_FORMATS;
  const candidates = formats.length > 1 ? formats.filter((f) => f.name !== lastFormat) : formats;
  return weightedPick(candidates, rand);
}

export function pickTopic(pillar, rand = Math.random) {
  const topics = pillar?.topics || [];
  if (topics.length === 0) return '';
  return topics[Math.floor(rand() * topics.length)];
}

/**
 * Rank research candidates: drop sources already used, prefer fresh tweets
 * (last `maxAgeHours`), then sort by engagement.
 */
export function rankSourceTweets(pool, usedIds = new Set(), now = Date.now(), maxAgeHours = 24) {
  const unique = new Map();
  for (const t of pool) {
    if (!t.id || usedIds.has(t.id) || unique.has(t.id)) continue;
    unique.set(t.id, t);
  }
  const all = [...unique.values()];
  const cutoff = now - maxAgeHours * 3600_000;
  const fresh = all.filter((t) => {
    const ts = new Date(t.createdAt).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
  const ranked = fresh.length > 0 ? fresh : all;
  const score = (t) => (t.favoriteCount || 0) + 3 * (t.retweetCount || 0);
  return ranked.sort((a, b) => score(b) - score(a));
}
