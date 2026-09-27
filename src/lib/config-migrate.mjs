/**
 * Config migration — bring an existing data/config.json up to the current
 * structure. Only ADDS missing keys; never overwrites a value the user set.
 * Used by the setup wizard and `npm run update-config`.
 */

export const AI_TECH_TOPICS = [
  'Tool AI mới',
  'Demo AI agent',
  'AI tạo ảnh/video',
  'Mẹo dùng ChatGPT/Claude/Gemini cho công việc',
  'AI x Crypto',
];

export const REPLY_BACK_DEFAULTS = {
  enabled: false,
  pollMinutes: 10,
  lookbackHours: 24,
  maxPerHour: 8,
  maxPerPost: 10,
  maxPerAuthorPerPost: 2,
  likeReplies: true,
};

export const AUTO_TUNE_DEFAULTS = {
  enabled: false,
  metric: 'views',
  minSamples: 5,
  minAgeHours: 24,
  maxAgeDays: 21,
  syncHours: 2,
};

/** Default pillars built from the legacy modeE fields (ai_tech off until it has lists). */
export function defaultPillars(modeE = {}) {
  return [
    {
      name: 'crypto',
      weight: 60,
      listIds: [...(modeE.listIds || [])],
      topics: [...(modeE.topics || [])],
      promptFile: 'prompts/post_original.txt',
    },
    {
      name: 'ai_tech',
      weight: 0, // set listIds + a weight (e.g. 40) to turn it on
      listIds: [],
      topics: [...AI_TECH_TOPICS],
      promptFile: 'prompts/post_ai_tech.txt',
    },
  ];
}

function fillMissing(target, defaults, prefix, added) {
  for (const [k, v] of Object.entries(defaults)) {
    if (target[k] === undefined) {
      target[k] = structuredClone(v);
      added.push(`${prefix}.${k}`);
    }
  }
}

/**
 * @param {object} cfg existing config (not mutated)
 * @returns {{ cfg: object, added: string[] }} migrated copy + list of added key paths
 */
export function migrateConfig(cfg) {
  const out = structuredClone(cfg || {});
  const added = [];

  if (out.mode === 'E' || out.modeE) {
    if (!out.modeE || typeof out.modeE !== 'object') {
      out.modeE = {};
      added.push('modeE');
    }
    const e = out.modeE;

    if (e.ownUsername === undefined) {
      e.ownUsername = (e.replyBack?.ownUsername || out.modeB?.ownerUsername || '').replace(/^@/, '');
      added.push('modeE.ownUsername');
    }
    if (!Array.isArray(e.pillars)) {
      e.pillars = defaultPillars(e);
      added.push('modeE.pillars');
    }
    if (e.reuseSourceMedia === undefined) {
      e.reuseSourceMedia = true;
      added.push('modeE.reuseSourceMedia');
    }
    if (!e.replyBack || typeof e.replyBack !== 'object') {
      e.replyBack = {};
      added.push('modeE.replyBack');
      fillMissing(e.replyBack, REPLY_BACK_DEFAULTS, 'modeE.replyBack', []);
    } else {
      fillMissing(e.replyBack, REPLY_BACK_DEFAULTS, 'modeE.replyBack', added);
    }
    if (!e.autoTune || typeof e.autoTune !== 'object') {
      e.autoTune = {};
      added.push('modeE.autoTune');
      fillMissing(e.autoTune, AUTO_TUNE_DEFAULTS, 'modeE.autoTune', []);
    } else {
      fillMissing(e.autoTune, AUTO_TUNE_DEFAULTS, 'modeE.autoTune', added);
    }
  }

  return { cfg: out, added };
}
