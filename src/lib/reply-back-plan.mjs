/**
 * Reply-back planning — decides which replies on our own posts to answer.
 * Pure functions only (no network / db) so they are easy to test.
 */

const URL_REGEX = /https?:\/\/\S+|\bt\.me\/|\bwa\.me\//i;
const SPAM_REGEX = /\b(dm me|inbox me|check (my|the) (bio|profile|pinned)|whatsapp|telegram me|airdrop claim|giveaway)\b|nhắn tin (cho )?mình|ib mình|xem bio/i;

/** Strip the leading "@a @b" mentions X adds to every reply. */
export function cleanReplyText(text) {
  return (text || '').replace(/^(\s*@\w+)+\s*/, '').trim();
}

/**
 * - 'ignore': link / promo spam — don't touch it
 * - 'like'  : too short to answer meaningfully (emoji, "gm", "+1") — like only
 * - 'reply' : answer it
 */
export function classifyReply(text) {
  const clean = cleanReplyText(text);
  if (URL_REGEX.test(clean) || SPAM_REGEX.test(clean)) return 'ignore';
  const letters = (clean.match(/\p{L}/gu) || []).length;
  if (letters < 4) return 'like';
  return 'reply';
}

/**
 * @param {object[]} tweets  search results (replies addressed to us)
 * @param {object}   o
 * @param {string}   o.me                  own username (without @)
 * @param {Map<string,string>} o.parents   tweetId we own → root post id
 * @param {(id:string)=>boolean} o.isHandled
 * @param {(rootId:string, author:string)=>number} o.countFor   past answers to author under root
 * @param {(rootId:string)=>number} o.countForRoot              past answers under root
 * @param {number} [o.maxPerAuthorPerPost=2]
 * @param {number} [o.maxPerPost=10]
 * @param {number} [o.lookbackHours=24]
 * @param {string[]} [o.skipUsers]
 * @param {number} [o.now]
 * @returns {{ tweet: object, rootId: string, action: 'reply'|'like'|'ignore' }[]} oldest first
 */
export function selectReplyCandidates(tweets, o) {
  const me = (o.me || '').toLowerCase();
  const skip = new Set((o.skipUsers || []).map((u) => u.toLowerCase()));
  const maxPerAuthor = o.maxPerAuthorPerPost ?? 2;
  const maxPerPost = o.maxPerPost ?? 10;
  const cutoff = (o.now ?? Date.now()) - (o.lookbackHours ?? 24) * 3600_000;

  const seen = new Set();
  const authorCounts = new Map();
  const rootCounts = new Map();
  const out = [];

  const sorted = [...tweets].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  for (const t of sorted) {
    if (!t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    const author = (t.author || '').toLowerCase();
    if (!author || author === me || skip.has(author)) continue;
    if (t.isRetweet) continue;
    const rootId = o.parents.get(t.inReplyToStatusId);
    if (!rootId) continue;
    if (new Date(t.createdAt).getTime() < cutoff) continue;
    if (o.isHandled(t.id)) continue;

    const action = classifyReply(t.fullText);
    if (action === 'reply') {
      const aKey = `${rootId}|${author}`;
      const aCount = (authorCounts.get(aKey) ?? o.countFor(rootId, author));
      const rCount = (rootCounts.get(rootId) ?? o.countForRoot(rootId));
      if (aCount >= maxPerAuthor || rCount >= maxPerPost) {
        out.push({ tweet: t, rootId, action: 'like' });
        continue;
      }
      authorCounts.set(aKey, aCount + 1);
      rootCounts.set(rootId, rCount + 1);
    }
    out.push({ tweet: t, rootId, action });
  }
  return out;
}
