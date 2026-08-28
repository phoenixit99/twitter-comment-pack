/**
 * Interactive setup wizard. Asks 5 questions, writes data/config.json + data/cookies.json.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawnSync } from 'child_process';

const DATA_DIR = path.resolve('data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

async function askMultiline(prompt) {
  console.log(prompt);
  console.log('(Paste content, then on a NEW line type EOF and press Enter)');
  return new Promise((res) => {
    let buf = '';
    const onLine = (line) => {
      if (line.trim() === 'EOF') {
        rl.removeListener('line', onLine);
        res(buf);
        return;
      }
      buf += line + '\n';
    };
    rl.on('line', onLine);
  });
}

function normalizeCookies(raw) {
  // Accepts:
  //   1) Cookie-Editor JSON array: [{name, value, domain, ...}, ...]
  //   2) Object with {auth_token, ct0, ...}
  //   3) Already-wrapped {cookies: [...]}
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Cookies input is not valid JSON: ' + e.message);
  }

  let cookies;
  if (Array.isArray(parsed)) {
    cookies = parsed.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.x.com',
      path: c.path || '/',
    }));
  } else if (parsed && Array.isArray(parsed.cookies)) {
    cookies = parsed.cookies;
  } else if (parsed && typeof parsed === 'object') {
    cookies = Object.entries(parsed).map(([name, value]) => ({
      name,
      value: String(value),
      domain: '.x.com',
      path: '/',
    }));
  } else {
    throw new Error('Unrecognized cookies format');
  }

  if (!cookies.find((c) => c.name === 'ct0')) {
    throw new Error('ct0 cookie not present — did you copy ALL cookies from x.com?');
  }
  if (!cookies.find((c) => c.name === 'auth_token')) {
    throw new Error('auth_token cookie not present');
  }
  return { cookies };
}

(async function main() {
  console.log('\n=== Twitter Comment Pack — Setup Wizard ===\n');
  console.log('You will be asked 5 short questions. See guides/ for help.\n');

  // Q1: cookies
  console.log('--- Question 1/5: Twitter cookies ---');
  console.log('Use the "Cookie-Editor" extension on x.com → Export → JSON.');
  console.log('You can also paste {"auth_token": "...", "ct0": "..."} format.');
  const rawCookies = await askMultiline('Paste cookies JSON now:');
  let cookieObj;
  try {
    cookieObj = normalizeCookies(rawCookies);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookieObj, null, 2));
  console.log(`Saved ${cookieObj.cookies.length} cookies to ${COOKIES_PATH}\n`);

  // Q2: Telegram
  console.log('--- Question 2/5: Telegram alerts ---');
  console.log('See guides/02-get-telegram-token.md if you need help.');
  const tgToken = await ask('Telegram bot token (or leave blank to skip): ');
  let tgChatId = '';
  if (tgToken) tgChatId = await ask('Telegram chat ID: ');

  // Load existing config if available
  let existingCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      existingCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {}
  }

  // Q3: Mode
  console.log('\n--- Question 3/5: Mode ---');
  console.log('  A = List comment (you give list IDs, bot comments per language/style)');
  console.log('  B = Amplify (when you post, bot comments on hashtag tweets pointing back)');
  console.log('  C = Hybrid (alternate A and B)');
  console.log('  D = Auto Post (scan list, use top tweets as inspiration to auto post)');
  console.log('  E = Autonomous Post (Dual Loop: Autonomous Post + List Comment)');
  console.log('  See guides/03-modes-explained.md for full details.');
  let mode = '';
  while (!['A', 'B', 'C', 'D', 'E'].includes(mode)) {
    mode = (await ask(`Choose mode (A/B/C/D/E) [${existingCfg.mode || 'A'}]: `)).toUpperCase() || existingCfg.mode || 'A';
  }

  const modeA = existingCfg.modeA || { listIds: [], language: 'auto', stylePrompt: '' };
  const modeB = existingCfg.modeB || { ownerUsername: '', hashtags: ['#XAUUSD', '#Gold', '#Crypto', '#Bitcoin'], crossPostListId: '' };
  const modeD = existingCfg.modeD || { listIds: [], language: 'auto', stylePrompt: '' };
  const modeE = existingCfg.modeE || {
    listIds: [],
    schedule: {
      slots: [
        { name: "morning_breakdown", start: "07:00", end: "09:00" },
        { name: "midday_news", start: "11:30", end: "13:00" },
        { name: "afternoon_alpha", start: "15:00", end: "17:00" },
        { name: "evening_question", start: "20:00", end: "22:00" },
        { name: "midnight_degen", start: "23:30", end: "23:59" },
        { name: "midnight_degen", start: "00:00", end: "01:00" }
      ]
    },
    topics: ["Bitcoin on-chain", "Ethereum Layer 2", "Solana DeFi", "Crypto thị trường vĩ mô"],
    maxRetries: 3
  };

  if (mode === 'A' || mode === 'C' || mode === 'E') {
    const defaultIds = (modeA.listIds || []).join(',');
    const ids = await ask(`  Mode A List IDs (comma-separated)${defaultIds ? ` [${defaultIds}]` : ''}: `);
    if (ids) modeA.listIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
    const lang = await ask(`  Language (auto|en|ja|ko|zh) [${modeA.language || 'auto'}]: `) || modeA.language || 'auto';
    modeA.language = lang;
    const style = await ask(`  Style/persona prompt${modeA.stylePrompt ? ` [${modeA.stylePrompt}]` : ' (free text)'}: `);
    if (style) modeA.stylePrompt = style;
  }
  
  if (mode === 'D') {
    const defaultIds = (modeD.listIds || []).join(',');
    const ids = await ask(`  Mode D List IDs (comma-separated)${defaultIds ? ` [${defaultIds}]` : ''}: `);
    if (ids) modeD.listIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
    const lang = await ask(`  Language (auto|en|ja|ko|zh) [${modeD.language || 'auto'}]: `) || modeD.language || 'auto';
    modeD.language = lang;
    const style = await ask(`  Style/persona prompt${modeD.stylePrompt ? ` [${modeD.stylePrompt}]` : ''}: `);
    if (style) modeD.stylePrompt = style;
  }

  if (mode === 'E') {
    const defaultIds = (modeE.listIds && modeE.listIds.length > 0 ? modeE.listIds : modeA.listIds || []).join(',');
    const ids = await ask(`  Mode E Auto-Post Context List IDs (comma-separated)${defaultIds ? ` [${defaultIds}]` : ''}: `);
    if (ids) {
      modeE.listIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (!modeE.listIds || modeE.listIds.length === 0) {
      modeE.listIds = [...modeA.listIds];
    }
  }

  if (mode === 'B' || mode === 'C') {
    modeB.ownerUsername = await ask(`  Your Twitter @username [${modeB.ownerUsername || ''}]: `) || modeB.ownerUsername;
    const defaultTags = (modeB.hashtags || []).join(',');
    const tags = await ask(`  Hashtags to scan (comma-separated) [${defaultTags}]: `);
    if (tags) modeB.hashtags = tags.split(',').map((s) => s.trim()).filter(Boolean);
    modeB.crossPostListId = await ask(`  Optional cross-post list ID [${modeB.crossPostListId || 'skip'}]: `) || modeB.crossPostListId;
  }

  // Q4: rate
  console.log('\n--- Question 4/5: Rate ---');
  console.log('See guides/04-rate-limits.md. Safe: 10-20/hr. Aggressive: 20-30. >30 risky.');
  const rateRaw = await ask(`Comments per hour [${existingCfg.commentsPerHour || 15}]: `);
  const rate = parseInt(rateRaw, 10) || existingCfg.commentsPerHour || 15;
  
  let postsPerDay = existingCfg.postsPerDay || 5;
  if (mode === 'D' || mode === 'E') {
    const postRateRaw = await ask(`Auto-Posts per day [${postsPerDay}]: `);
    postsPerDay = parseInt(postRateRaw, 10) || postsPerDay;
  }

  // Q5: AI
  console.log('\n--- Question 5/5: AI provider ---');
  console.log('Options: deepseek (cheap, default) | openai | anthropic');
  const defaultProvider = existingCfg.ai?.provider || 'deepseek';
  let provider = (await ask(`Provider [${defaultProvider}]: `)).toLowerCase() || defaultProvider;
  if (!['deepseek', 'openai', 'anthropic'].includes(provider)) provider = 'deepseek';
  const apiKey = await ask(`${provider} API key${existingCfg.ai?.apiKey ? ' (press Enter to keep existing)' : ''}: `) || existingCfg.ai?.apiKey;
  const model = await ask(`Model override [${existingCfg.ai?.model || 'default'}]: `) || existingCfg.ai?.model || '';

  const cfg = {
    ...existingCfg,
    cookiesFile: 'data/cookies.json',
    telegram: { botToken: tgToken || existingCfg.telegram?.botToken || '', chatId: tgChatId || existingCfg.telegram?.chatId || '' },
    mode,
    modeA,
    modeB,
    modeD,
    modeE,
    commentsPerHour: rate,
    postsPerDay,
    delayMinMs: existingCfg.delayMinMs || 60000,
    delayMaxMs: existingCfg.delayMaxMs || 240000,
    ai: { provider, apiKey, model },
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  console.log(`\nWrote ${CONFIG_PATH}`);

  // Auto-start
  if (process.platform === 'win32') {
    const auto = (await ask('\nAuto-start on Windows boot? (Y/n): ')).toLowerCase();
    if (auto !== 'n') {
      const r = spawnSync(process.execPath, ['scripts/install-autostart.mjs'], { stdio: 'inherit' });
      if (r.status !== 0) console.log('(autostart install failed — you can re-run with: npm run install-service)');
    }
  }

  console.log('\nSetup complete! Start the bot with:  npm start');
  console.log('Logs:  data/run.log');
  rl.close();
})();
