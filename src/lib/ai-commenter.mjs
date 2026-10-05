/**
 * Multi-provider AI comment generator.
 * Supports: deepseek, openai, anthropic. All via fetch — no SDK deps.
 */
import fs from 'fs';
import path from 'path';
import { isFollowBackRequest, followBackReply } from './language.mjs';

// Vietnamese with diacritics costs far more tokens per character than English;
// 200 tokens could cut a 280-char post mid-sentence.
const MAX_TOKENS = 400;

const LANG_INSTRUCTION = {
  en: 'Write the reply in English.',
  ja: '日本語で返信を書いてください。',
  ko: '한국어로 답글을 작성하세요.',
  zh: '请用中文（简体）写回复。',
};

function buildPrompt({ tweetText, lang, style }) {
  const styleLine = style && style.trim()
    ? `Style/persona: ${style.trim()}`
    : 'Style: human, casual, natural — not robotic.';
  return `You are a real Twitter user leaving a comment on a tweet. Your comment must be:
- 1-2 sentences max (under 200 characters)
- Human and natural, NOT robotic or AI-sounding
- Contextually appropriate to the tweet (funny, supportive, insightful, or curious)
- No hashtags, no URLs, minimal emoji
- ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}
- ${styleLine}

Tweet content:
"${tweetText.slice(0, 500)}"

Reply with ONLY the comment text. Nothing else.`;
}

function buildPostPrompt({ tweetText, lang, style }) {
  const styleLine = style && style.trim()
    ? `Style/persona: ${style.trim()}`
    : 'Style: human, natural — not robotic.';
  return `You are a creative content creator on Twitter. Read the following tweet and write a completely NEW, standalone post (NOT a reply) inspired by it. Your new post must be:
- 1-3 sentences max (under 280 characters)
- Express a similar or expanded viewpoint, but worded completely differently
- Human and natural, NOT robotic or AI-sounding
- No hashtags, no URLs, minimal emoji
- ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}
- ${styleLine}

Source inspiration tweet:
"${tweetText.slice(0, 500)}"

Reply with ONLY the new post text. Nothing else.`;
}

async function callDeepseek({ apiKey, model, prompt }) {
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: 0.95,
      }),
    });
    if (!res.ok) {
      // Log warning but don't throw to allow fallback or graceful degradation
      console.warn(`DeepSeek warning: HTTP ${res.status} - ${(await res.text()).slice(0, 200)}`);
      return '';
    }
    const data = await res.json();
    if (data?.choices?.[0]?.finish_reason === 'length') {
      console.warn('DeepSeek warning: output hit max_tokens, discarding truncated text');
      return '';
    }
    return (data?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.warn('DeepSeek request failed:', e.message);
    return '';
  }
}

async function callOpenAI({ apiKey, model, prompt }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: 0.95,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data?.choices?.[0]?.finish_reason === 'length') throw new Error('OpenAI output truncated (max_tokens)');
  return (data?.choices?.[0]?.message?.content || '').trim();
}

async function callAnthropic({ apiKey, model, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5',
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data?.stop_reason === 'max_tokens') throw new Error('Anthropic output truncated (max_tokens)');
  const block = (data?.content || []).find((b) => b.type === 'text');
  return (block?.text || '').trim();
}

export async function generateComment({ tweetText, lang, style, ai, isModeE }) {
  if (isFollowBackRequest(tweetText)) {
    return followBackReply(lang);
  }
  
  let prompt = '';
  if (isModeE) {
    try {
      const sysPrompt = fs.readFileSync(path.resolve('prompts/comment_support.txt'), 'utf-8');
      prompt = sysPrompt.replace('{{TWEET_TEXT}}', tweetText.slice(0, 500));
    } catch (e) {
      prompt = buildPrompt({ tweetText, lang, style });
    }
  } else {
    prompt = buildPrompt({ tweetText, lang, style });
  }

  const provider = (ai.provider || 'deepseek').toLowerCase();
  let text = '';
  if (provider === 'deepseek') {
    text = await callDeepseek({ apiKey: ai.apiKey, model: ai.model, prompt });
    // If DeepSeek returned empty (e.g., due to quota), try fallback to OpenAI if configured
    if (!text && ai.fallbackProvider) {
      const fallback = ai.fallbackProvider.toLowerCase();
      if (fallback === 'openai') {
        text = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt });
      } else if (fallback === 'anthropic') {
        text = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt });
      }
    }
  } else if (provider === 'openai') {
    text = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt });
  } else if (provider === 'anthropic') {
    text = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt });
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  if (!text) throw new Error('AI returned empty comment');
  // Strip surrounding quotes if model added them
  return text.replace(/^["'`]+|["'`]+$/g, '').trim();
}

export async function generatePost({ tweetText, lang, style, ai }) {
  const prompt = buildPostPrompt({ tweetText, lang, style });
  const provider = (ai.provider || 'deepseek').toLowerCase();
  let text = '';
  if (provider === 'deepseek') text = await callDeepseek({ apiKey: ai.apiKey, model: ai.model, prompt });
  else if (provider === 'openai') text = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt });
  else if (provider === 'anthropic') text = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt });
  else throw new Error(`Unknown AI provider: ${provider}`);

  if (!text) throw new Error('AI returned empty post');
  return text.replace(/^["'`]+|["'`]+$/g, '').trim();
}

function buildAgenticPostPrompt({ topic, researchContext, lang, style }) {
  const styleLine = style && style.trim()
    ? `Style/persona: ${style.trim()}`
    : 'Style: human, natural — not robotic.';
  return `You are a creative content creator on Twitter. Write a NEW, standalone post about the topic: "${topic}".
Use the following recent research/news as context to make your post insightful and accurate:
---
${researchContext}
---

Your post must be:
- 1-3 sentences max (under 280 characters)
- Engaging and interesting
- Human and natural, NOT robotic or AI-sounding
- No hashtags, no URLs, minimal emoji
- ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}
- ${styleLine}

Reply with ONLY the new post text. Nothing else.`;
}

export async function generateAgenticPost({ topic, researchContext, lang, style, ai }) {
  const prompt = buildAgenticPostPrompt({ topic, researchContext, lang, style });
  const provider = (ai.provider || 'deepseek').toLowerCase();
  let text = '';
  if (provider === 'deepseek') text = await callDeepseek({ apiKey: ai.apiKey, model: ai.model, prompt });
  else if (provider === 'openai') text = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt });
  else if (provider === 'anthropic') text = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt });
  else throw new Error(`Unknown AI provider: ${provider}`);

  if (!text) throw new Error('AI returned empty post');
  return text.replace(/^["'`]+|["'`]+$/g, '').trim();
}

export async function generateCryptoOriginal({ postType, topic, researchContext, recentOpenings, ai, promptFile, format }) {
  const file = promptFile || 'prompts/post_original.txt';
  let sysPrompt = '';
  try {
    sysPrompt = fs.readFileSync(path.resolve(file), 'utf-8');
  } catch (e) {
    throw new Error(`Missing ${file}`);
  }

  // Custom prompts without a {{FORMAT}} placeholder still get the format rule
  if (format?.instruction && !sysPrompt.includes('{{FORMAT}}')) {
    sysPrompt += '\n\nĐỊNH DẠNG BÀI LẦN NÀY: {{FORMAT}}';
  }

  const prompt1 = sysPrompt
    .replaceAll('{{POST_TYPE}}', postType || 'midday_news')
    .replaceAll('{{TOPIC}}', topic || 'tự chọn theo tin trong RESEARCH CONTEXT')
    .replaceAll('{{FORMAT}}', format?.instruction || '')
    .replaceAll('{{RESEARCH_CONTEXT}}', researchContext || '')
    .replaceAll('{{RECENT_OPENINGS}}', recentOpenings && recentOpenings.length > 0 ? recentOpenings.map(o => `- ${o}`).join('\n') : 'Chưa có bài nào gần đây.')
    .replaceAll('{{EMOJI}}', '')
    .replaceAll('{{HASHTAGS}}', '');

  const provider = (ai.provider || 'deepseek').toLowerCase();
  let post = '';
  if (provider === 'deepseek') {
    post = await callDeepseek({ apiKey: ai.apiKey, model: ai.model, prompt: prompt1 });
    if (!post && ai.fallbackProvider) {
      const fallback = ai.fallbackProvider.toLowerCase();
      if (fallback === 'openai') {
        post = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt: prompt1 });
      } else if (fallback === 'anthropic') {
        post = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt: prompt1 });
      }
    }
  } else if (provider === 'openai') {
    post = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt: prompt1 });
  } else if (provider === 'anthropic') {
    post = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt: prompt1 });
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  
  if (!post) throw new Error('AI returned empty post');

  return post.replace(/^["'`]+|["'`]+$/g, '').trim();
}

async function callProvider(ai, prompt) {
  const provider = (ai.provider || 'deepseek').toLowerCase();
  let text = '';
  if (provider === 'deepseek') {
    text = await callDeepseek({ apiKey: ai.apiKey, model: ai.model, prompt });
    if (!text && ai.fallbackProvider) {
      const fallback = ai.fallbackProvider.toLowerCase();
      if (fallback === 'openai') text = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt });
      else if (fallback === 'anthropic') text = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt });
    }
  } else if (provider === 'openai') {
    text = await callOpenAI({ apiKey: ai.apiKey, model: ai.model, prompt });
  } else if (provider === 'anthropic') {
    text = await callAnthropic({ apiKey: ai.apiKey, model: ai.model, prompt });
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  return text;
}

/**
 * Answer a reply left on one of our own posts (Mode E reply-back).
 */
export async function generateReplyBack({ myPost, theirReply, author, ai, promptFile }) {
  const file = promptFile || 'prompts/reply_back.txt';
  let sysPrompt = '';
  try {
    sysPrompt = fs.readFileSync(path.resolve(file), 'utf-8');
  } catch (e) {
    throw new Error(`Missing ${file}`);
  }
  const prompt = sysPrompt
    .replaceAll('{{MY_POST}}', (myPost || '(không có nội dung)').slice(0, 600))
    .replaceAll('{{THEIR_REPLY}}', (theirReply || '').slice(0, 500))
    .replaceAll('{{AUTHOR}}', author || '');

  const text = await callProvider(ai, prompt);
  if (!text) throw new Error('AI returned empty reply');
  return text.replace(/^["'`]+|["'`]+$/g, '').trim();
}
